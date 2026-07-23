"""
Fable-Manager — منسّق يخلّي Fable 5 المدير، وSonnet 5 / Opus 4.8 المنفّذ.

الفكرة (تجمع طريقتيك):
  • Fable 5 (المدير، غالٍ → نستخدمه قليلاً): يخطّط المهام الفرعية، يراجع مخرجات
    المنفّذ ويصحّحها إن لزم، ثم يجمّع النتيجة النهائية.
  • المنفّذ (Sonnet 5 أو Opus 4.8، أرخص → يولّد أغلب التوكنز): ينفّذ كل مهمة فرعية.

ملاحظة: لا نستخدم أداة Anthropic الرسمية "Advisor" هنا لأنها لا تقبل Fable كمستشار
(المستشار فيها لازم Opus 4.8/4.7). فنبني التنسيق بأنفسنا — وهذا يسمح بجعل Fable المدير.

تشغيل:
  pip install anthropic
  ثم صادق:  ant auth login   (أو)   setx ANTHROPIC_API_KEY sk-ant-...
  python manager.py
"""

import json
import os
import re
import sys
from datetime import datetime

from anthropic import Anthropic, APIError

client = Anthropic()  # يقرأ ANTHROPIC_API_KEY أو ملف تعريف `ant auth login`

# ================== الإعدادات ==================
MANAGER = "claude-fable-5"        # المدير: يخطّط/يراجع/يجمّع (غالٍ → قليل التوكنز)
WORKER  = "claude-sonnet-5"       # المنفّذ: مهام البناء (غيّرها إلى "claude-opus-4-8" وقارن)
SCOUT   = "claude-haiku-4-5"      # الكشّاف: بحث وجمع معلومات (الأرخص)
FALLBACK_WORKER = "claude-opus-4-8"  # بديل المنفّذ عند رفض السلامة
SUPERVISE = True                  # Fable يراجع ويصحّح المنفّذ
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
# ==============================================


def model_for(tier):
    """يحوّل تصنيف المهمة الفرعية إلى موديل: scout → Haiku، وما عداه → Sonnet."""
    return SCOUT if tier == "scout" else WORKER

# --- تتبّع الاستهلاك الفعلي لكل موديل (لتقارن التكلفة بنفسك) ---
_usage = {}
def _normalize_model(model):
    """يوحّد معرّف الموديل: يزيل لاحقة التاريخ -YYYYMMDD إن وُجدت (مثل claude-haiku-4-5-20251001)."""
    return re.sub(r"-\d{8}$", "", model)


def _track(model, u):
    model = _normalize_model(model)
    d = _usage.setdefault(model, {"in": 0, "out": 0, "calls": 0})
    d["in"] += u.input_tokens
    d["out"] += u.output_tokens
    d["calls"] += 1


class RefusalError(RuntimeError):
    """مصنّفات السلامة رفضت الطلب (stop_reason == "refusal")."""


def call(model, system, user, max_tokens=16000, effort="high"):
    """نداء واحد. يوجّه خصائص كل موديل: Fable (تفكير دائم + fallback)،
    Haiku (بلا thinking وبلا effort — كلاهما يرفضهما)، والبقية تفكير تكيّفي."""
    common = dict(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    if model == MANAGER:
        # Fable: نحذف thinking (التفكير دائماً مفعّل) + نفعّل fallback الخادم عند الرفض
        resp = client.beta.messages.create(
            betas=["server-side-fallback-2026-06-01"],
            fallbacks=[{"model": FALLBACK_WORKER}],
            output_config={"effort": effort},
            **common,
        )
    elif model == SCOUT:
        # Haiku 4.5: لا يدعم adaptive thinking ولا output_config.effort
        resp = client.messages.create(**common)
    else:
        # Sonnet 5 / Opus 4.8: تفكير تكيّفي + effort
        resp = client.messages.create(
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            **common,
        )
    if resp.stop_reason == "refusal":
        raise RefusalError(f"طلب مرفوض: {resp.stop_details}")
    _track(getattr(resp, "model", model), resp.usage)
    return "".join(b.text for b in resp.content if b.type == "text").strip()


# ================== خطوات التنسيق ==================
def plan(task):
    """Fable يخطّط: يقسّم المهمة إلى مهام فرعية مصنّفة (كشف رخيص أو تنفيذ)."""
    system = (
        "أنت المدير. قسّم المهمة إلى 2–5 مهام فرعية مستقلة وملموسة. "
        'أعِد فقط مصفوفة JSON من كائنات بالشكل {"tier": "scout" أو "worker", "task": "..."}. '
        "اجعل tier=scout لمهام البحث/جمع المعلومات الرخيصة، وtier=worker لمهام البناء والتنفيذ. "
        "بلا أي شرح خارج JSON."
    )
    try:
        raw = call(MANAGER, system, f"المهمة:\n{task}", max_tokens=1500, effort="high")
    except (RefusalError, APIError) as e:
        print(f"[Fable/مدير] تعذّر التخطيط ({e}) → مهمة واحدة للمنفّذ")
        return [{"tier": "worker", "task": task}]
    start = raw.find("[")
    if start == -1:
        return [{"tier": "worker", "task": task}]
    try:
        items, _ = json.JSONDecoder().raw_decode(raw[start:])
    except json.JSONDecodeError:
        return [{"tier": "worker", "task": task}]
    subtasks = []
    for item in items:
        if isinstance(item, str):
            subtasks.append({"tier": "worker", "task": item})
        elif isinstance(item, dict) and item.get("task"):
            tier = item.get("tier") if item.get("tier") in ("scout", "worker") else "worker"
            subtasks.append({"tier": tier, "task": item["task"]})
    return subtasks or [{"tier": "worker", "task": task}]


def execute(subtask, task, tier="worker", correction=None):
    """المنفّذ (أو الكشّاف) ينفّذ مهمة فرعية؛ وعند رفض السلامة نعيدها على Opus 4.8."""
    system = "أنت منفّذ. نفّذ هذه المهمة الفرعية بإتقان وإيجاز. أخرِج النتيجة فقط."
    prompt = f"الهدف العام: {task}\n\nمهمتك: {subtask}"
    if correction:
        prompt += f"\n\nتصحيح المدير: {correction}"
    model = model_for(tier)
    try:
        return call(model, system, prompt, effort="high")
    except RefusalError:
        if model == FALLBACK_WORKER:
            raise
        print(f"  [{model}] رفض سلامة → إعادة المحاولة على {FALLBACK_WORKER}")
        return call(FALLBACK_WORKER, system, prompt, effort="high")


def review(subtask, result):
    """Fable يراجع (بجهد منخفض = أرخص). يرجّع 'OK' أو تعليمة تصحيح قصيرة."""
    system = (
        "أنت المدير تراجع مخرجات المنفّذ. إن كانت صحيحة وكاملة، أجب حرفياً 'OK'. "
        "وإلا أجب بتعليمة تصحيح قصيرة واحدة فقط."
    )
    verdict = call(MANAGER, system, f"المهمة: {subtask}\n\nالمخرجات:\n{result}",
                   max_tokens=800, effort="low").strip()
    return "OK" if verdict.rstrip(".") == "OK" else verdict


def synthesize(task, results):
    """Fable يجمّع النتائج في إجابة نهائية؛ وإن تعذّر، نرجّع النتائج الخام مجمّعة."""
    system = "أنت المدير. ادمج نتائج المهام الفرعية في إجابة نهائية واحدة متماسكة."
    joined = "\n\n".join(f"### {s}\n{r}" for s, r in results)
    try:
        return call(MANAGER, system, f"المهمة: {task}\n\nالنتائج:\n{joined}")
    except (RefusalError, APIError) as e:
        print(f"[Fable/مدير] تعذّر التجميع ({e}) → نعيد النتائج الخام")
        return joined


def _snip(text, n):
    return text[:n] + ("..." if len(text) > n else "")


def run(task):
    subtasks = plan(task)
    scouts = sum(1 for s in subtasks if s["tier"] == "scout")
    print(f"[Fable/مدير] خطّط {len(subtasks)} مهام فرعية → "
          f"كشف={scouts} ({SCOUT})، تنفيذ={len(subtasks) - scouts} ({WORKER})")
    results = []
    for i, st in enumerate(subtasks, 1):
        tier, text = st["tier"], st["task"]
        print(f"  [{model_for(tier)}] ({i}/{len(subtasks)}) {_snip(text, 50)}")
        try:
            out = execute(text, task, tier=tier)
            if SUPERVISE:
                verdict = review(text, out)
                if verdict != "OK":
                    print(f"  [Fable/مدير] صحّح: {_snip(verdict, 60)}")
                    out = execute(text, task, tier=tier, correction=verdict)
        except (RefusalError, APIError) as e:
            # مهمة فرعية فاشلة لا تُسقط بقية التشغيلة — نسجّلها ونكمل
            out = f"(فشلت هذه المهمة الفرعية: {e})"
            print(f"  !! {_snip(out, 80)}")
        results.append((text, out))
    print("[Fable/مدير] يجمّع النتيجة النهائية...")
    return synthesize(task, results)


# أسعار platform.claude.com بتاريخ 2026-07-09 — (إدخال, إخراج) لكل مليون توكن بالدولار
PRICES = {
    "claude-fable-5":   (10.0, 50.0),
    "claude-opus-4-8":  (5.0, 25.0),
    "claude-sonnet-5":  (2.0, 10.0),   # سعر تمهيدي حتى 2026-08-31، بعدها (3.0, 15.0)
    "claude-haiku-4-5": (1.0, 5.0),
}
def report():
    print("\n==== الاستهلاك الفعلي ====")
    total = 0.0
    for model, d in _usage.items():
        line = f"{model:18} | {d['calls']} نداء | إدخال {d['in']:>8,} | إخراج {d['out']:>8,}"
        p = PRICES.get(model)
        if p:
            cost = d["in"] / 1e6 * p[0] + d["out"] / 1e6 * p[1]
            total += cost
            line += f" | ~${cost:.4f}"
        else:
            line += " | (لا سعر مسجّل)"
        print(line)
    if total:
        print(f"الإجمالي التقريبي: ${total:.4f}")


def save_log(task, final):
    """يحفظ سجل التشغيلة (المهمة + النتيجة + الاستهلاك) في logs/ ويرجّع المسار."""
    os.makedirs(LOGS_DIR, exist_ok=True)
    path = os.path.join(LOGS_DIR, f"fable-run-{datetime.now():%Y%m%d-%H%M%S}.md")
    usage_lines = "\n".join(
        f"- {m}: {d['calls']} نداء | إدخال {d['in']:,} | إخراج {d['out']:,}"
        for m, d in _usage.items()
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# المهمة\n{task}\n\n# النتيجة النهائية\n{final}\n\n# الاستهلاك\n{usage_lines}\n")
    return path


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    task = " ".join(sys.argv[1:]).strip() or (
        "اكتب صفحة HTML مستقلة لعدّاد نقرات فيه زر زيادة وزر تصفير، بتصميم أنيق."
    )
    final = run(task)
    log_path = save_log(task, final)  # نحفظ أولاً حتى لا يضيع الناتج لو فشلت الطباعة
    print("\n==== النتيجة النهائية ====\n")
    print(final)
    report()
    print(f"\nحُفظ السجل: {log_path}")

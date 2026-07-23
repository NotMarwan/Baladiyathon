# Fable-as-Manager Delegation Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Swarm's `fable-orchestrator/manager.py` into a full 3-tier delegation system (Fable 5 manager → Sonnet 5 workers → Haiku 4.5 scouts), make it resilient and cost-transparent, and document the pattern across the swarm (AGENTS.md × 4, HOW-IT-WORKS.md) — per the-decoder article: orchestrator pattern ≈ 96% of Fable-solo quality at ≈ 46% cost; advisor pattern ≈ 92% at 63%.

**Architecture:** `manager.py` keeps its plan → execute → review → synthesize loop. `plan()` now labels each subtask with a tier (`scout` = cheap research → Haiku 4.5; `worker` = build/execute → Sonnet 5). `call()` routes per-model API differences (Fable: thinking always-on + server-side refusal fallback; Sonnet 5: adaptive thinking + effort; Haiku 4.5: plain call — **no** `output_config.effort`, **no** adaptive thinking, both error on Haiku). Refusals no longer crash the run: worker refusals retry once on Opus 4.8; any subtask failure is recorded and the run continues.

**Tech Stack:** Python 3 + `anthropic` SDK (already used). Tests: `pytest` with monkeypatched `manager.call` / fake responses — **tests must never hit the real API**.

## Global Constraints

- **No git repository** in `C:\Users\wasan\Downloads\Swarm` — do NOT `git init`, do NOT commit. Skip all commit steps.
- **Never make a real Anthropic API call** during implementation or tests (cost). All tests use fakes/monkeypatching.
- Model IDs (exact, no date suffixes): `claude-fable-5`, `claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5`.
- Prices per 1M tokens (input, output) in USD: fable (10.0, 50.0) · opus-4-8 (5.0, 25.0) · sonnet-5 **(2.0, 10.0) intro until 2026-08-31, then (3.0, 15.0)** · haiku-4-5 (1.0, 5.0).
- Haiku 4.5 rejects `output_config.effort` and adaptive thinking — the Haiku branch of `call()` must send neither.
- Fable 5: omit `thinking` entirely; keep `betas=["server-side-fallback-2026-06-01"]` + `fallbacks=[{"model": "claude-opus-4-8"}]` (already in the file).
- Keep the file's existing style: Arabic comments/prints, module-level functions, no classes except the new exception.
- Windows paths; write files as UTF-8.

## File Structure

- Modify: `fable-orchestrator/manager.py` (single responsibility: the orchestration loop — stays < 250 lines)
- Create: `fable-orchestrator/tests/test_manager.py` (all unit tests, fake client, no network)
- Modify: `agent1/AGENTS.md`, `agent2/AGENTS.md`, `agent3/AGENTS.md`, `agent4/AGENTS.md` (append one identical section)
- Modify: `HOW-IT-WORKS.md` (append one architecture section)

Tasks 1–4 all edit `manager.py` → **one worker executes them sequentially**. Task 5 and Task 6 are independent → parallel workers.

---

### Task 1: Tiered planning + model routing (manager.py)

**Files:**
- Modify: `fable-orchestrator/manager.py`
- Test: `fable-orchestrator/tests/test_manager.py` (create)

**Interfaces:**
- Produces: `SCOUT = "claude-haiku-4-5"`, `WORKER = "claude-sonnet-5"`, `FALLBACK_WORKER = "claude-opus-4-8"`, `model_for(tier: str) -> str`, `plan(task) -> list[dict]` where each dict is `{"tier": "scout"|"worker", "task": str}`.
- Consumes: existing `call()`, `MANAGER`.

- [ ] **Step 1: Create the test file with failing tests for routing + plan parsing**

Create `fable-orchestrator/tests/test_manager.py`:

```python
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import manager


def test_model_for_routes_scout_to_haiku():
    assert manager.model_for("scout") == "claude-haiku-4-5"


def test_model_for_routes_worker_and_unknown_to_sonnet():
    assert manager.model_for("worker") == "claude-sonnet-5"
    assert manager.model_for("anything-else") == "claude-sonnet-5"


def test_plan_parses_tiered_json(monkeypatch):
    canned = json.dumps([
        {"tier": "scout", "task": "ابحث عن مصادر"},
        {"tier": "worker", "task": "ابنِ الصفحة"},
    ])
    monkeypatch.setattr(manager, "call", lambda *a, **k: canned)
    result = manager.plan("مهمة كبيرة")
    assert result == [
        {"tier": "scout", "task": "ابحث عن مصادر"},
        {"tier": "worker", "task": "ابنِ الصفحة"},
    ]


def test_plan_coerces_plain_strings_and_bad_tiers_to_worker(monkeypatch):
    canned = json.dumps(["مهمة نصية", {"tier": "boss", "task": "بلا تصنيف صحيح"}])
    monkeypatch.setattr(manager, "call", lambda *a, **k: canned)
    result = manager.plan("مهمة")
    assert result == [
        {"tier": "worker", "task": "مهمة نصية"},
        {"tier": "worker", "task": "بلا تصنيف صحيح"},
    ]


def test_plan_falls_back_to_single_worker_on_garbage(monkeypatch):
    monkeypatch.setattr(manager, "call", lambda *a, **k: "لا يوجد JSON هنا")
    assert manager.plan("مهمة") == [{"tier": "worker", "task": "مهمة"}]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v` (from repo root)
Expected: FAIL — `AttributeError: module 'manager' has no attribute 'model_for'` (and plan returns strings, not dicts). If `pytest` is missing: `pip install pytest`.

- [ ] **Step 3: Implement settings, `model_for`, and tiered `plan()`**

In `manager.py`, replace the settings block (lines 24–28):

```python
# ================== الإعدادات ==================
MANAGER = "claude-fable-5"        # المدير: يخطّط/يراجع/يجمّع (غالٍ → قليل التوكنز)
WORKER  = "claude-sonnet-5"       # المنفّذ: مهام البناء (غيّرها إلى "claude-opus-4-8" وقارن)
SCOUT   = "claude-haiku-4-5"      # الكشّاف: بحث وجمع معلومات (الأرخص)
FALLBACK_WORKER = "claude-opus-4-8"  # بديل المنفّذ عند رفض السلامة
SUPERVISE = True                  # Fable يراجع ويصحّح المنفّذ
# ==============================================


def model_for(tier):
    """يحوّل تصنيف المهمة الفرعية إلى موديل: scout → Haiku، وما عداه → Sonnet."""
    return SCOUT if tier == "scout" else WORKER
```

Then replace `plan()` (currently lines 66–74):

```python
def plan(task):
    """Fable يخطّط: يقسّم المهمة إلى مهام فرعية مصنّفة (كشف رخيص أو تنفيذ)."""
    system = (
        "أنت المدير. قسّم المهمة إلى 2–5 مهام فرعية مستقلة وملموسة. "
        'أعِد فقط مصفوفة JSON من كائنات بالشكل {"tier": "scout" أو "worker", "task": "..."}. '
        "اجعل tier=scout لمهام البحث/جمع المعلومات الرخيصة، وtier=worker لمهام البناء والتنفيذ. "
        "بلا أي شرح خارج JSON."
    )
    raw = call(MANAGER, system, f"المهمة:\n{task}", max_tokens=1500, effort="high")
    m = re.search(r"\[.*\]", raw, re.S)
    if not m:
        return [{"tier": "worker", "task": task}]
    try:
        items = json.loads(m.group(0))
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
```

Update every other reference to the old `EXECUTOR` name (`execute()`, `run()` prints) to use `WORKER` — Task 2/3 rewrite those functions anyway.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v`
Expected: 5 PASS (if `execute`/`run` still reference `EXECUTOR`, fix those references now — `NameError` counts as failure).

---

### Task 2: Per-model call routing + refusal as exception (manager.py)

**Files:**
- Modify: `fable-orchestrator/manager.py:39-62` (the `call()` function) and imports
- Test: `fable-orchestrator/tests/test_manager.py`

**Interfaces:**
- Produces: `class RefusalError(RuntimeError)`, `call(model, system, user, max_tokens=16000, effort="high") -> str` routing: MANAGER → beta+fallbacks (no thinking), SCOUT → plain create (no thinking, no output_config), else → adaptive thinking + effort.
- Consumes: `MANAGER`, `SCOUT` from Task 1.

- [ ] **Step 1: Add failing tests for call routing and refusal**

Append to `tests/test_manager.py`:

```python
class FakeUsage:
    input_tokens = 100
    output_tokens = 50


class FakeBlock:
    type = "text"
    text = "نتيجة"


class FakeResp:
    def __init__(self, model, stop_reason="end_turn"):
        self.model = model
        self.stop_reason = stop_reason
        self.stop_details = {"type": "refusal"} if stop_reason == "refusal" else None
        self.usage = FakeUsage()
        self.content = [FakeBlock()]


class FakeMessages:
    def __init__(self, log):
        self.log = log

    def create(self, **kwargs):
        self.log.append(kwargs)
        return FakeResp(kwargs["model"])


class FakeClient:
    def __init__(self):
        self.calls = []
        self.messages = FakeMessages(self.calls)
        self.beta = type("B", (), {"messages": FakeMessages(self.calls)})()


def test_call_scout_sends_no_thinking_and_no_output_config(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(manager, "client", fake)
    manager.call(manager.SCOUT, "sys", "user")
    kwargs = fake.calls[0]
    assert "thinking" not in kwargs
    assert "output_config" not in kwargs


def test_call_worker_sends_adaptive_thinking_and_effort(monkeypatch):
    fake = FakeClient()
    monkeypatch.setattr(manager, "client", fake)
    manager.call(manager.WORKER, "sys", "user", effort="low")
    kwargs = fake.calls[0]
    assert kwargs["thinking"] == {"type": "adaptive"}
    assert kwargs["output_config"] == {"effort": "low"}


def test_call_raises_refusal_error(monkeypatch):
    fake = FakeClient()

    def refuse(**kwargs):
        return FakeResp(kwargs["model"], stop_reason="refusal")

    fake.messages.create = refuse
    monkeypatch.setattr(manager, "client", fake)
    with pytest.raises(manager.RefusalError):
        manager.call(manager.WORKER, "sys", "user")
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v`
Expected: previous 5 PASS; new 3 FAIL (`no attribute 'RefusalError'`; scout call currently sends `output_config`).

- [ ] **Step 3: Rewrite `call()` with per-model routing**

Replace `call()` (and add the exception class just above it):

```python
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
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v`
Expected: 8 PASS.

---

### Task 3: Resilient run loop — refusal fallback + failed subtasks don't kill the run (manager.py)

**Files:**
- Modify: `fable-orchestrator/manager.py` — `execute()`, `review()`, `run()`, imports
- Test: `fable-orchestrator/tests/test_manager.py`

**Interfaces:**
- Produces: `execute(subtask, task, tier="worker", correction=None) -> str` (retries once on `FALLBACK_WORKER` after `RefusalError`), `run(task) -> str` (per-subtask try/except; failures recorded as text, loop continues).
- Consumes: `RefusalError`, `model_for`, tiered `plan()`.

- [ ] **Step 1: Add failing tests**

Append to `tests/test_manager.py`:

```python
def test_execute_retries_on_opus_after_refusal(monkeypatch):
    attempts = []

    def fake_call(model, system, user, **kwargs):
        attempts.append(model)
        if model == manager.WORKER:
            raise manager.RefusalError("مرفوض")
        return "نجحت على أوبس"

    monkeypatch.setattr(manager, "call", fake_call)
    result = manager.execute("مهمة فرعية", "الهدف")
    assert result == "نجحت على أوبس"
    assert attempts == [manager.WORKER, manager.FALLBACK_WORKER]


def test_run_continues_when_one_subtask_fails(monkeypatch):
    monkeypatch.setattr(manager, "SUPERVISE", False)
    monkeypatch.setattr(
        manager, "plan",
        lambda task: [
            {"tier": "worker", "task": "تفشل"},
            {"tier": "worker", "task": "تنجح"},
        ],
    )

    def fake_execute(subtask, task, tier="worker", correction=None):
        if subtask == "تفشل":
            raise manager.RefusalError("مرفوضة نهائياً")
        return "تمّت"

    monkeypatch.setattr(manager, "execute", fake_execute)
    captured = {}

    def fake_synthesize(task, results):
        captured["results"] = results
        return "النهائي"

    monkeypatch.setattr(manager, "synthesize", fake_synthesize)
    assert manager.run("مهمة") == "النهائي"
    assert len(captured["results"]) == 2
    assert "فشلت" in captured["results"][0][1]
    assert captured["results"][1][1] == "تمّت"


def test_review_accepts_ok_with_trailing_period(monkeypatch):
    monkeypatch.setattr(manager, "call", lambda *a, **k: "OK.")
    assert manager.review("مهمة", "نتيجة") == "OK"
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v`
Expected: new 3 FAIL (`execute()` has no `tier` param; `run()` crashes on refusal; `review` returns `"OK."` verbatim).

- [ ] **Step 3: Implement resilient `execute()`, normalized `review()`, resilient `run()`**

Add `from anthropic import Anthropic, APIError` at the top (replacing the bare `Anthropic` import). Then:

```python
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


def run(task):
    subtasks = plan(task)
    scouts = sum(1 for s in subtasks if s["tier"] == "scout")
    print(f"[Fable/مدير] خطّط {len(subtasks)} مهام فرعية → "
          f"كشف={scouts} ({SCOUT})، تنفيذ={len(subtasks) - scouts} ({WORKER})")
    results = []
    for i, st in enumerate(subtasks, 1):
        tier, text = st["tier"], st["task"]
        print(f"  [{model_for(tier)}] ({i}/{len(subtasks)}) {text[:50]}...")
        try:
            out = execute(text, task, tier=tier)
            if SUPERVISE:
                verdict = review(text, out)
                if verdict != "OK":
                    print(f"  [Fable/مدير] صحّح: {verdict[:60]}")
                    out = execute(text, task, tier=tier, correction=verdict)
        except (RefusalError, APIError) as e:
            # مهمة فرعية فاشلة لا تُسقط بقية التشغيلة — نسجّلها ونكمل
            out = f"(فشلت هذه المهمة الفرعية: {e})"
            print(f"  !! {out[:80]}")
        results.append((text, out))
    print("[Fable/مدير] يجمّع النتيجة النهائية...")
    return synthesize(task, results)
```

Note: `synthesize()` stays as-is. The broad `APIError` catch here is deliberate — the SDK already retries transient errors (max_retries=2 default); at this level we only decide "record failure, keep going".

- [ ] **Step 4: Run tests to verify all pass**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v`
Expected: 11 PASS.

---

### Task 4: Real prices, cost report, CLI, run log (manager.py)

**Files:**
- Modify: `fable-orchestrator/manager.py` — `PRICES`, `report()`, `__main__`, imports; add `save_log()`
- Test: `fable-orchestrator/tests/test_manager.py`

**Interfaces:**
- Produces: `PRICES: dict[str, tuple]` filled; `report() -> None`; `save_log(task: str, final: str) -> str` (returns path, writes UTF-8 markdown into repo `logs/`); CLI: `python manager.py "المهمة"`.

- [ ] **Step 1: Add failing tests**

Append to `tests/test_manager.py`:

```python
def test_prices_filled_for_all_four_models():
    for model in ("claude-fable-5", "claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5"):
        prices = manager.PRICES[model]
        assert isinstance(prices, tuple) and len(prices) == 2
        assert prices[0] > 0 and prices[1] > 0


def test_report_totals_cost(monkeypatch, capsys):
    monkeypatch.setattr(manager, "_usage", {
        "claude-haiku-4-5": {"in": 1_000_000, "out": 1_000_000, "calls": 2},
    })
    manager.report()
    out = capsys.readouterr().out
    assert "$6.0000" in out  # 1M×$1 دخل + 1M×$5 خرج


def test_save_log_writes_utf8_markdown(tmp_path, monkeypatch):
    monkeypatch.setattr(manager, "LOGS_DIR", str(tmp_path))
    path = manager.save_log("مهمة تجريبية", "نتيجة نهائية")
    text = Path(path).read_text(encoding="utf-8")
    assert "مهمة تجريبية" in text and "نتيجة نهائية" in text
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v`
Expected: new 3 FAIL (PRICES has `None` values; no `LOGS_DIR`/`save_log`).

- [ ] **Step 3: Implement**

Top of file, extend imports:

```python
import json
import os
import re
import sys
from datetime import datetime

from anthropic import Anthropic, APIError
```

Add near the settings block:

```python
LOGS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logs")
```

Replace `PRICES`:

```python
# أسعار platform.claude.com بتاريخ 2026-07-09 — (إدخال, إخراج) لكل مليون توكن بالدولار
PRICES = {
    "claude-fable-5":   (10.0, 50.0),
    "claude-opus-4-8":  (5.0, 25.0),
    "claude-sonnet-5":  (2.0, 10.0),   # سعر تمهيدي حتى 2026-08-31، بعدها (3.0, 15.0)
    "claude-haiku-4-5": (1.0, 5.0),
}
```

In `report()`, delete the last hint line (`"(عبّئ PRICES ..."`) — prices are now filled. Add `save_log()` after `report()`:

```python
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
```

Replace `__main__`:

```python
if __name__ == "__main__":
    task = " ".join(sys.argv[1:]).strip() or (
        "اكتب صفحة HTML مستقلة لعدّاد نقرات فيه زر زيادة وزر تصفير، بتصميم أنيق."
    )
    final = run(task)
    print("\n==== النتيجة النهائية ====\n")
    print(final)
    report()
    print(f"\nحُفظ السجل: {save_log(task, final)}")
```

- [ ] **Step 4: Run the full suite**

Run: `python -m pytest fable-orchestrator/tests/test_manager.py -v`
Expected: 14 PASS. Also run `python -c "import ast; ast.parse(open(r'fable-orchestrator/manager.py', encoding='utf-8').read())"` → no output (syntax clean). Do NOT run `python manager.py` (real API calls).

---

### Task 5: Delegation policy section in the four AGENTS.md files

**Files:**
- Modify: `agent1/AGENTS.md`, `agent2/AGENTS.md`, `agent3/AGENTS.md`, `agent4/AGENTS.md`

**Interfaces:**
- Produces: one identical section appended to the END of each file. No other lines touched.

- [ ] **Step 1: Append this exact section to each of the 4 files**

```markdown

## 💰 Model & Delegation Policy (Fable-as-Manager)
This swarm follows the manager-delegates pattern (orchestrator ≈96% of Fable-solo quality at ≈46% cost; advisor ≈92% at 63% — the-decoder, 2026):
- **You are a Sonnet 5 worker.** The expensive manager (Fable 5) plans, reviews, and merges; you build. Don't burn tokens re-planning the whole project — execute YOUR task above.
- **Delegate cheap lookups to Haiku subagents** (reading many files, web research, fact collection) when your tool supports subagents; keep your own context for building.
- **Escalate to the manager** (human broadcast, or `python fable-orchestrator/manager.py "task"`) only when: requirements conflict, a decision changes another agent's scope, or you're blocked after 2 attempts.
- **Never redo another agent's work** — read their vault report instead.
```

- [ ] **Step 2: Verify**

Run: `python - <<'PY'` style check or Grep for `Model & Delegation Policy` — expect exactly 4 matches, one per file. Confirm each file still starts with its original `# 🎯 CURRENT FOCUS` heading and the section sits at the end.

---

### Task 6: Architecture section in HOW-IT-WORKS.md

**Files:**
- Modify: `HOW-IT-WORKS.md` (append at end; match the file's existing language/style — read it first)

- [ ] **Step 1: Append this section** (translate headings to Arabic if the file is Arabic-first; keep code/prices verbatim):

```markdown

## Fable-as-Manager: the delegation layer (added 2026-07-09)

Based on Anthropic's cost fix for Fable 5 (the-decoder, 2026): Fable stops doing everything itself and manages cheaper models instead. Two proven patterns:
- **Orchestrator** — Fable plans → Sonnet 5 workers execute → Fable reviews & merges: ≈96% of Fable-solo quality at ≈46% of the cost.
- **Advisor** — Sonnet 5 executes and consults Fable only when stuck: ≈92% at 63%.

### How this repo implements it
`fable-orchestrator/manager.py` is the orchestrator:
1. **plan** — Fable 5 splits the task into 2–5 subtasks, each tagged `scout` (research) or `worker` (build).
2. **execute** — `scout` → Haiku 4.5 ($1/$5 per MTok), `worker` → Sonnet 5 ($2/$10 intro until 2026-08-31). Safety refusals retry once on Opus 4.8.
3. **review** — Fable checks each result at low effort; sends one correction if needed.
4. **synthesize** — Fable merges everything into the final answer.
5. **report + log** — real token costs per model printed and saved to `logs/fable-run-*.md`.

Usage: `python fable-orchestrator/manager.py "مهمتك هنا"`

The four WezTerm swarm agents (agent1–4) follow the same policy — see the "Model & Delegation Policy" section in each `agentN/AGENTS.md`.
```

- [ ] **Step 2: Verify** — reread the appended file end; heading level must match the document's existing hierarchy.

---

## Out of Scope (deliberate — YAGNI before the July 14 registration deadline)

- A separate "advisor mode" flag in manager.py (orchestrator mode covers the hackathon workload; documented in HOW-IT-WORKS.md only).
- Prompt caching / Batch API in manager.py (single-shot runs, low volume).
- Modifying `swarm-4term.ps1` / `.wezterm.lua` (works today; model policy lives in AGENTS.md).
- Parallel subtask execution inside manager.py (adds threading complexity; sequential is fine at this scale).

## Self-Review (done at plan time)

- Spec coverage: 3-tier routing ✔ (T1–2), resilience ✔ (T3), cost transparency ✔ (T4), swarm docs ✔ (T5–6).
- Placeholder scan: none — all code inline.
- Type consistency: `plan()` returns `list[dict{tier,task}]` consumed by `run()` ✔; `model_for` used in `execute`/`run` ✔; `LOGS_DIR` defined in T4 and monkeypatched in tests ✔.

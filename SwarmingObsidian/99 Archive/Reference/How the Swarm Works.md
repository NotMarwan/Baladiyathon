# كيف اشتغل نظام الـ 4 Claude Code (شرح كامل عشان تسوّيه بنفسك)

هذا شرح لكل قطعة في النظام: وش الأدوات، وين الملفات، وكيف تعيد بناءه من الصفر أو تعدّله.

---

## 1) الفكرة باختصار

نافذة واحدة فيها 4 تيرمنلز (شبكة 2×2)، كل واحد يشغّل نسخة `claude` مستقلة في مجلد خاص فيه.
تقدر:
- **تبثّ** أمر واحد للأربعة كلهم بضغطة زر.
- **تنسخ** أحداث تيرمنل واحد، أو الأربعة كلهم، إلى ملف بضغطة زر.

الأداة المستخدمة: **WezTerm** (تيرمنل مجاني، native على ويندوز، وعنده Lua API يقدر يقرأ محتوى أي بان — وهذا سر ميزة "انسخ الكل").

---

## 2) القطع الأربع (وين كل شي)

| القطعة | المسار | الوظيفة |
|---|---|---|
| برنامج WezTerm | `C:\Program Files\WezTerm\wezterm-gui.exe` | التيرمنل نفسه |
| ملف الإعداد | `C:\Users\wasan\.wezterm.lua` | **العقل** — التقسيم + الأزرار + البث + النسخ |
| مجلدات الوكلاء | `...\Swarm\agent1` ... `agent4` | كل claude يشتغل في مجلده (عزل) |
| ملفات المهام | `...\Swarm\agentN\MISSION.md` | تعليمات كل وكيل (هويته + مهمته) |
| مجلد النسخ | `...\Swarm\logs\` | تُحفظ فيه ملفات النسخ |

> WezTerm يقرأ الإعداد تلقائياً من `C:\Users\<اسمك>\.wezterm.lua`. هذا هو السبب إنه حطّيناه هناك.

---

## 3) إعادة البناء من الصفر (خطوة بخطوة)

```powershell
# 1) ثبّت WezTerm
winget install --id wez.wezterm -e --accept-package-agreements --accept-source-agreements

# 2) سوِّ مجلدات الوكلاء + مجلد النسخ
cd "C:\Users\wasan\Downloads\Swarm"
mkdir agent1, agent2, agent3, agent4, logs
```

3) سوِّ ملف الإعداد `C:\Users\<اسمك>\.wezterm.lua` (انسخ الموجود عندك — هو المرجع الكامل).
4) حط `MISSION.md` داخل كل مجلد `agentN` (تعليمات ذاك الوكيل).
5) شغّل: افتح WezTerm من قائمة ابدأ، أو:
```powershell
& "C:\Program Files\WezTerm\wezterm-gui.exe"
```

---

## 4) شرح ملف الإعداد (`.wezterm.lua`) قطعة قطعة

### أ) أمر تشغيل كل وكيل
```lua
local function agent_cmd(n)
  local dir = 'C:\\Users\\wasan\\Downloads\\Swarm\\agent' .. n
  return { 'cmd', '/k', 'cd /d ' .. dir .. ' && title AGENT-' .. n .. ' && claude' }
end
```
- `cd /d <المجلد>` = **يجبر** التيرمنل يدخل مجلد الوكيل (هذا اللي صلّح مشكلة "كلهم Agent 1").
- `title AGENT-N` = يسمّي البان.
- `claude` = يشغّل Claude Code.
- 💡 لو `claude` ما اشتغل، بدّل آخر كلمة بـ: `powershell -NoExit -Command claude`.

### ب) فتح الشبكة 2×2
```lua
wezterm.on('gui-startup', function()
  local tab, p1, window = mux.spawn_window { cwd = ROOT .. '/agent1', args = agent_cmd(1) }
  local p2 = p1:split { direction = 'Right',  size = 0.5, args = agent_cmd(2) }
  local p3 = p1:split { direction = 'Bottom', size = 0.5, args = agent_cmd(3) }
  local p4 = p2:split { direction = 'Bottom', size = 0.5, args = agent_cmd(4) }
end)
```
- `spawn_window` = يفتح البان الأول (agent1).
- `p1:split{Right}` = يشقّه لنص → يمين = agent2.
- `p1:split{Bottom}` = يشقّ اليسار → تحت = agent3.
- `p2:split{Bottom}` = يشقّ اليمين → تحت = agent4.
- ⚠️ `gui-startup` يشتغل **مرة وحدة** عند بداية WezTerm. عشان كذا لما تغيّر التقسيم لازم **تقفل كل نوافذ WezTerm وتفتح من جديد** (مو مجرد إعادة تحميل الإعداد).

### ج) الأزرار
```lua
config.keys = {
  { key = 'S', mods = 'CTRL|SHIFT', action = act.EmitEvent 'capture-current' },
  { key = 'A', mods = 'CTRL|SHIFT', action = act.EmitEvent 'capture-all' },
  { key = 'B', mods = 'CTRL|SHIFT', action = act.PromptInputLine { ... } },
}
```
- `Ctrl+Shift+S` → ينسخ التيرمنل الحالي (ينادي دالة `capture-current`).
- `Ctrl+Shift+A` → ينسخ الكل (دالة `capture-all`).
- `Ctrl+Shift+B` → يفتح صندوق كتابة، واللي تكتبه يُرسل للأربعة (البث).

### د) كيف يشتغل "انسخ"
```lua
local function full_text(pane)
  local dims = pane:get_dimensions()
  return pane:get_lines_as_text(dims.scrollback_rows)  -- كل التاريخ مو بس المرئي
end
```
`capture-all` يلفّ على كل البانات (`window:mux_window():tabs()` ثم `tab:panes()`)، يقرأ نص كل واحد، ويجمعهم في ملف واحد بمجلد `logs`. ولأننا حاطين `scrollback_lines = 100000`، النسخ يطلع كامل.

### هـ) كيف يشتغل "البث"
```lua
for _, tab in ipairs(window:mux_window():tabs()) do
  for _, p in ipairs(tab:panes()) do
    p:send_text(line .. '\r')   -- \r = يضغط Enter
  end
end
```
يلفّ على كل بان ويرسل له النص + Enter. يعني تكتب مرة، يوصل الأربعة.

---

## 5) كيف يعرف كل وكيل هويته؟ (نقطة مهمة)

**الهوية = المجلد.** كل بان يشتغل في مجلد مختلف، وكل مجلد فيه `MISSION.md` يبدأ بـ "You are Agent N". فلما تبثّ:
> "اقرأ MISSION.md في مجلدك الحالي ونفّذه"

كل واحد يقرأ ملفه هو → يعرف نفسه تلقائياً. **ما تحتاج تسمّيهم يدوياً.**

---

## 6) الاستخدام اليومي

1. افتح WezTerm (قائمة ابدأ) → تفتح النافذة بالأربعة جاهزين.
2. `Ctrl+Shift+B` → اكتب أمرك → Enter → يوصل الكل.
3. `Ctrl+Shift+A` → لما يخلصون، ينسخ نتائج الأربعة في ملف واحد بـ `logs`.
4. التنقّل بين البانات: `Ctrl+Shift+الأسهم`. تكبير بان: `Ctrl+Shift+Z`.

---

## 7) تعديلات شائعة

**تبي 6 وكلاء بدل 4؟**
1. سوِّ `agent5`, `agent6` + ملفات `MISSION.md`.
2. زِد سطرين split في `gui-startup`.

**تبي أمر مختلف بدل claude؟** غيّر آخر كلمة في `agent_cmd` (مثلاً `python`، `npm run dev`...).

**تبي تغيّر الأزرار؟** عدّل `key` و`mods` في `config.keys`.

**تبي تعرف اسم أي أمر/زر في WezTerm؟** الوثائق الرسمية: https://wezfurlong.org/wezterm/

---

## 8) حل المشاكل

| المشكلة | الحل |
|---|---|
| كلهم يطلعون بنفس المجلد / نفس الوكيل | تأكد `cd /d` موجود في `agent_cmd`، وأعد الفتح من جديد |
| غيّرت التقسيم وما تغيّر | اقفل **كل** نوافذ WezTerm ثم افتح (gui-startup يشتغل مرة وحدة) |
| `claude` مو معروف | بدّله بـ `powershell -NoExit -Command claude` في `agent_cmd` |
| تأكد أي بان هو أي وكيل | اكتب `cd` في البان، يطلع المسار |
| تحقّق أن الإعداد سليم | `& "C:\Program Files\WezTerm\wezterm.exe" show-keys` (يطبع الأزرار أو الخطأ) |
| تقفل WezTerm بالقوة | `Get-Process wezterm-gui \| Stop-Process -Force` |

---

## 9) الخلاصة بجملة

WezTerm يقرأ `~/.wezterm.lua` → الملف يفتح 4 بانات كل واحد `cd` لمجلده ويشغّل claude → الأزرار تنادي دوال Lua تلفّ على البانات لتقرأ نصّها (نسخ) أو ترسل لها نص (بث). كل الذكاء في ملف واحد: `.wezterm.lua`.

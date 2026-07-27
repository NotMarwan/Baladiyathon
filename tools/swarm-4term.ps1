# يفتح نافذة Windows Terminal واحدة فيها 4 تيرمنلز (شبكة 2×2)
# الطريقة 1: كليك يمين على الملف -> Run with PowerShell
# الطريقة 2: من التيرمنل شغّل:  .\swarm-4term.ps1
#
# داخل النافذة:
#   Alt+الأسهم         = تنقّل بين التيرمنلز
#   Alt+Shift+I        = تفعيل "البث": تكتب مرة وحدة توصل الأربعة كلهم
#   Alt+Shift+الأسهم   = تغيير حجم البان

$dir = "C:\Users\wasan\Downloads\Swarm"

wt -d $dir `
  `; split-pane -V -d $dir `
  `; split-pane -H -d $dir `
  `; move-focus left `
  `; split-pane -H -d $dir

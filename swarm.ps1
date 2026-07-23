# swarm.ps1 — مشغّل السرب متعدّد المشاريع
# يختار مشروعاً داخل Swarm، ينشئ agent1..4، ويفتح WezTerm بـ 4 نسخ opencode.
# شغّله بالضغط على اختصار "Swarm Launcher" أو:  powershell -ExecutionPolicy Bypass -File swarm.ps1

$ErrorActionPreference = 'Stop'
$Swarm = 'C:\Users\wasan\Downloads\Swarm'
$Wez   = 'C:\Program Files\WezTerm\wezterm-gui.exe'

# مجلدات البنية التحتية — تُستثنى من قائمة المشاريع
$reserved = @('agent1','agent2','agent3','agent4','presentation','logs','proven',
              'SwarmingObsidian','_archive','_default','scratchpad')

Write-Host ''
Write-Host '  ====== SWARM LAUNCHER ======' -ForegroundColor Cyan
Write-Host '  اختر المشروع الذي يعمل عليه الـ 4 agents:' -ForegroundColor Gray
Write-Host ''

$projects = @(
  Get-ChildItem -LiteralPath $Swarm -Directory |
    Where-Object { $reserved -notcontains $_.Name -and $_.Name[0] -ne '.' } |
    Select-Object -ExpandProperty Name | Sort-Object
)

Write-Host '  [0] athar   (المجلد الجذر — المشروع الحالي)' -ForegroundColor Green
$i = 1
foreach ($p in $projects) { Write-Host ("  [{0}] {1}" -f $i, $p); $i++ }
Write-Host '  [N] + مشروع جديد' -ForegroundColor Yellow
Write-Host ''
$choice = Read-Host '  اختيارك'

if ($choice -eq '0') {
  $root = $Swarm ; $name = 'athar (root)'
}
elseif ($choice -match '^[Nn]$') {
  $new  = Read-Host '  اسم المشروع الجديد'
  $name = ($new -replace '\s+','-')
  if ([string]::IsNullOrWhiteSpace($name)) { Write-Host '  اسم فارغ.' -ForegroundColor Red; Start-Sleep 2; exit 1 }
  $root = Join-Path $Swarm $name
}
elseif ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $projects.Count) {
  $name = $projects[[int]$choice - 1] ; $root = Join-Path $Swarm $name
}
else { Write-Host '  اختيار غير صحيح.' -ForegroundColor Red; Start-Sleep 2; exit 1 }

# أنشئ agent1..4 + AGENTS.md مبدئي إن لم توجد
foreach ($n in 1..4) {
  $dir = Join-Path $root "agent$n"
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $af = Join-Path $dir 'AGENTS.md'
  if (-not (Test-Path $af)) {
    "# Project: $name -- Agent $n`n`nYou are Agent $n of 4 in the '$name' swarm. Work inside this folder. Wait for the user's shared plan, then do your part." |
      Out-File -Encoding utf8 -FilePath $af
  }
}

# مرّر الاختيار للويزترم وافتح نسخة جديدة (mux نظيف عشان gui-startup يشتغل)
$env:SWARM_PROJECT = $root
Get-Process wezterm-gui,wezterm -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 700
Start-Process -FilePath $Wez

Write-Host ''
Write-Host ("  ✔ فُتح السرب على: {0}" -f $name) -ForegroundColor Green
Write-Host ("    المسار: {0}\agent1..4" -f $root) -ForegroundColor DarkGray
Start-Sleep -Milliseconds 1400

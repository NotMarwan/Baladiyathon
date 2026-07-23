# Swarm Reorg + Graphify Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline execution chosen — token-budget constraint from user). Steps use checkbox (`- [ ]`) syntax.

**Goal:** All Baladiyathon 2026 (Athar) content under one folder `Baladiyathon/`; everything unrelated under `not related/`; knowledge graph over Baladiyathon content becomes the navigation engine, documented in root `README.md`.

**Architecture:** Pure file reorganization (PowerShell `Move-Item -LiteralPath`, non-destructive — nothing deleted), then graphify pipeline on `Baladiyathon/`, then README declaring graph-first navigation for agents.

**Tech Stack:** PowerShell, graphifyy (Python 3.13), graphify-out/ at repo root.

## Global Constraints

- No deletions. Moves only.
- Not a git repo — no commits.
- Token budget tight: no subagents except graphify semantic-extraction chunks (mandated by graphify skill), max chunk size 25 to minimize agent count.
- `.claude/` stays at root (Claude Code project config breaks if moved).
- Arabic filenames require `-LiteralPath`.

---

### Task 1: Create target folders + move content

**Files:**
- Create: `Baladiyathon/`, `not related/`
- Move into `Baladiyathon/`: `agent1 agent2 agent3 agent4 docs fable-orchestrator logs presentation proven SwarmingObsidian _archive HOW-IT-WORKS.md MASTER-REVIEW.md skills-lock.json swarm-4term.ps1 swarm.ps1` + 8 Arabic root .md files (اجوبة-الفورم، المرجع-الرسمي-للهاكاثون، بطاقة-الفكرة، تقرير-التقييم-النهائي، تقييم-الأفكار-النهائية، تقييم-الأفكار، خطة-الدمج-والإقصاء، معايير-التقييم-الصارمة)
- Move into `not related/`: `testproj`, `كتاب لحمد الطبخ`, `.pytest_cache`

**Interfaces:**
- Produces: `Baladiyathon/` as graphify INPUT_PATH for Task 2. Relative paths inside swarm scripts stay valid because all swarm folders move together.

- [ ] **Step 1: Create folders and move (single PowerShell block)**

```powershell
$root = "C:\Users\wasan\Downloads\Swarm"
New-Item -ItemType Directory -Force "$root\Baladiyathon" | Out-Null
New-Item -ItemType Directory -Force "$root\not related" | Out-Null
$bal = @("agent1","agent2","agent3","agent4","docs","fable-orchestrator","logs","presentation","proven","SwarmingObsidian","_archive","HOW-IT-WORKS.md","MASTER-REVIEW.md","skills-lock.json","swarm-4term.ps1","swarm.ps1","اجوبة-الفورم.md","المرجع-الرسمي-للهاكاثون.md","بطاقة-الفكرة.md","تقرير-التقييم-النهائي.md","تقييم-الأفكار-النهائية.md","تقييم-الأفكار.md","خطة-الدمج-والإقصاء.md","معايير-التقييم-الصارمة.md")
foreach ($i in $bal) { Move-Item -LiteralPath "$root\$i" -Destination "$root\Baladiyathon\" }
foreach ($i in @("testproj","كتاب لحمد الطبخ",".pytest_cache")) { Move-Item -LiteralPath "$root\$i" -Destination "$root\not related\" }
```

- [ ] **Step 2: Verify**

Run: `Get-ChildItem $root | Select Name` — expect exactly: `.claude`, `Baladiyathon`, `not related`.

### Task 2: Graphify Baladiyathon

**Interfaces:**
- Consumes: `Baladiyathon/` from Task 1.
- Produces: `graphify-out/graph.json`, `graph.html`, `GRAPH_REPORT.md` at repo root — query interface `graphify query "<question>"`.

- [ ] **Step 1:** Run graphify skill pipeline, INPUT_PATH=`Baladiyathon`, cwd=Swarm root. Follow skill Steps 1–9. Chunk size 25 for semantic subagents (minimize count). Check GEMINI_API_KEY first — if set, zero subagents.
- [ ] **Step 2:** Verify `graphify-out/graph.json` node count > 0; run `graphify query "ما هو أثر"` smoke test.

### Task 3: README — graph-first navigation

**Files:**
- Create: `C:\Users\wasan\Downloads\Swarm\README.md`

- [ ] **Step 1:** Write README (Arabic+English): structure map, rule "navigation via graphify" for agents (`graphify query/path/explain`, `graphify-out/graph.json` as machine-readable index), pointer to `Baladiyathon/SwarmingObsidian/00 Athar - Home.md` as source of truth.
- [ ] **Step 2:** Verify README exists and paths in it resolve.

## Self-Review

- Spec coverage: one-folder Baladiyathon ✅ (Task 1), not-related ✅ (Task 1), graphify navigation ✅ (Task 2), README ✅ (Task 3).
- No placeholders ✅. No TDD cycle — no code written, moves + generated artifacts only (justified deviation).
- Risk: `.pytest_cache` relates to fable-orchestrator tests but is regenerable cache → "not related" acceptable.

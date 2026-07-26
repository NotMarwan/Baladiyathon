# 🎯 CURRENT FOCUS — Masar (مسار) ONLY

We now have ONE project: **Masar (مسار)** — Challenge 3, Baladiyathon 2026. Everything else is finished and archived. If you were doing anything else, stop and switch to Masar.

## ✅ You are in the right place if you read THIS file. Confirm by:
- Your folder contains only `AGENTS.md` (this file). Old `MISSION*.md` are gone — they were stale.
- The source of truth is the vault + the dossier below, NOT files in this folder.

## Where Masar lives (read in this order)
1. Home: `C:/Users/wasan/Downloads/Swarm/SwarmingObsidian/00 Masar - Home.md`
2. Master spec: `SwarmingObsidian/01 Masar/Masar - Master.md`
3. Final dossier (judged artifact): `C:/Users/wasan/Downloads/Swarm/presentation/masar-merged.html`
4. Extra capabilities: `SwarmingObsidian/01 Masar/New Capabilities (research).md`
5. Merges & fixes applied: `SwarmingObsidian/01 Masar/Merges & Fixes.md`

## Do NOT touch (archived)
- Other projects (Raqib, Mutabiq), old missions, all other concepts:
  `C:/Users/wasan/Downloads/Swarm/_archive/` and `SwarmingObsidian/99 Archive/`.

## Rules that still hold
- Real facts only + a Sources Ledger. Balady stats: ~2.5M users, ~659K commercial licenses, ~234K construction permits.
- **NO drones, no personal data.** Masar has none — keep it that way.

## 🛠️ YOUR Masar task — Agent 2: Impact engine (always-on)
Build the scoring engine (as `presentation/masar-engine.js` or an inline module Agent 1 can import):
- **BPR analytical impact score** that ALWAYS works without SUMO (the demo-safety fix) — input: lanes closed, corridor volume, duration → delay index → red/yellow/green.
- **CO₂ meter:** idle/stopped-time × a published idle-emission factor → kg CO₂ saved by the chosen schedule.
- **Dig-Once SAR calculator:** (n separate digs × excavation cost) − (1 shared trench) → riyals saved.
- **Explainability:** return the "top-3 factors" behind the recommended schedule.
Provide sample inputs/outputs. Cite the emission factor + FHWA cost source in a Sources Ledger. Summarize in `SwarmingObsidian/01 Masar/Engine.md`.

## 💰 Model & Delegation Policy (Fable-as-Manager)
This swarm follows the manager-delegates pattern (orchestrator ≈96% of Fable-solo quality at ≈46% cost; advisor ≈92% at 63% — the-decoder, 2026):
- **You are a Sonnet 5 worker.** The expensive manager (Fable 5) plans, reviews, and merges; you build. Don't burn tokens re-planning the whole project — execute YOUR task above.
- **Delegate cheap lookups to Haiku subagents** (reading many files, web research, fact collection) when your tool supports subagents; keep your own context for building.
- **Escalate to the manager** (human broadcast, or `python fable-orchestrator/manager.py "task"`) only when: requirements conflict, a decision changes another agent's scope, or you're blocked after 2 attempts.
- **Never redo another agent's work** — read their vault report instead.

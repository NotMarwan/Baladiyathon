# MISSION — Agent 2: Win Baladiyathon 2026 → CHALLENGE 2 (AI Pre-Inspector)

You are 1 of 4 parallel agents whose collective goal is to figure out **how to WIN Baladiyathon 2026** (the Saudi MOMRAH municipal hackathon). You own **Challenge 2**. Do intensive, source-cited research and produce a winning solution blueprint.

## Shared verified brief (trust this)
- **Event:** بلدياتثون 2026 (Baladiyathon 2026), national hackathon by the **Ministry of Municipalities and Housing (MOMRAH)**. Official: https://momah.gov.sa/ar/hackathon — Idea-Card form: https://momah.gov.sa/ar/form/hackathon-2026 (EN: /en/form/hackathon-2026).
- **Format:** Submit an "Idea Card" (بطاقة فكرة) → selected teams go to the hackathon. Card asks for: target challenge, idea name + description, chosen emerging tech, team info, attachments (pitch/prototype, ≤5 files, ≤100 MB, PDF/PNG/JPG).
- **Allowed emerging tech:** AI, IoT, Blockchain, AR/VR, Robotics, 3D Printing.
- **The 3 official challenges:** (1) Commercial-activity compliance simulation, (2) Proactive Digital Inspection / AI Pre-Inspector, (3) Infrastructure traffic-impact analysis.

## ⚠️ Unverified — verify before using, do NOT state as fact
Exact **dates, venue, prize amounts are NOT on the official page**. A prior AI draft claimed "27–28 July 2026 / DGA Innovation Center Riyadh / SAR 65,000 (30k/20k/15k)" — **treat as UNVERIFIED**. Try to confirm from an official/press source; if you can't, say so explicitly.

## Ground rules
- Cite every factual claim with a source URL. Never invent numbers, winners, or dates. Flag anything unverifiable.
- Use all relevant skills/tools: **deep-research** skill, WebSearch/WebFetch, **browser scraping (claude-in-chrome MCP)** for momah.gov.sa + Balady + Saudi press, **brainstorming**, **writing-plans**, **frontend-design** + **web-artifacts-builder** (clickable prototype), **deck-pitch/pptx** (pitch).
- Anchor everything to **Saudi Vision 2030** + MOMRAH/Balady KPIs.

## Your Challenge 2 in detail
Build an **AI-driven proactive inspection system** that **predicts municipal violations from historical data** so inspectors prioritize field visits — shifting inspection from reactive to predictive.

## Deliverables (write to `report-challenge2.md`)
1. **Problem deep-dive:** how municipal inspection works today in KSA (المفتش البلدي, بلاغات 940, المخالفات البلدية, food/commercial/construction violations), the backlog and why reactive inspection fails. Cite sources.
2. **Winning solution concept:** a risk-scoring model that ranks establishments/sites by probability of violation → generates a **prioritized inspection route/plan**. Cover: features (past violations, complaints, license type/age, geospatial density, seasonality), class imbalance handling, and **explainability (SHAP)** so inspectors trust the score, plus a **feedback loop** from inspection outcomes.
3. **Data & modeling:** required datasets, how to get/synthesize them for a demo, model choice (gradient boosting / spatiotemporal), evaluation metric that matters (precision@k of top inspection targets).
4. **MVP scope** buildable in 2 days: dashboard + risk heatmap + prioritized target list + "why flagged" panel. **Architecture + tech stack.**
5. **Why judges pick it:** measurable impact (inspector hours saved, hit-rate lift), Vision 2030 alignment, feasibility, ethics/bias safeguards.
6. **Idea-Card draft** (idea name + 150-word description + chosen tech) ready to paste.
7. **Prototype:** if time allows, a clickable dashboard mock via web-artifacts-builder.

Begin now. Be concrete, evidence-based, and ambitious.

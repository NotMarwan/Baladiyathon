# Baladiyathon 2026 — Challenge 1
## Proven-Precedent Research: Commercial-Activity Compliance / Pre-License Simulation

**Challenge 1 (official wording, momah.gov.sa/ar/hackathon):** "Develop a smart digital solution enabling investors to verify commercial activity compliance with professional, construction, and municipal requirements **before** license applications." (Professional & Construction Requirements Compliance Simulation.)

**Context:** بلدياتثون 2026 / MOMRAH. Registration closes 14 July 2026; hackathon 27–28 July 2026; prizes 30k / 20k / 15k SAR. Existing baseline to leapfrog = Balady app + **Smart Guide (الدليل الذكي, pilot launch Dec 2025)** — which is *informational only* (see gap analysis below). Balady scale: ~2.5M users, ~659K commercial licenses, ~234K construction permits (canonical figures per brief).

---

## STEP 1 — EVIDENCE SCAN (real, verified solutions)

| # | Name / Who / When | What it does | PROOF it worked (verified) | Coverage | In Saudi/GCC? |
|---|---|---|---|---|---|
| 1 | **OpenFisca "Rules as Code"** — open-source engine; France (origin, Assemblée Nationale/LexImpact), **NSW Australia** (Digital.NSW Accelerator + Fair Trading NSW), NZ Service Innovation Lab, Barcelona, Japan. 2011→present. | Turns *legislation/regulations into executable code* exposed via an open API. Computes eligibility, benefits, and **permit eligibility** from a citizen's/business's declared attributes. | **NSW used OpenFisca to assess eligibility to a business permit and to construction bonuses**; **Fair Trading NSW deployed a live OpenFisca rules engine so citizens can check whether they may conduct gaming activities**; NSW Dept of Customer Service made the **Community Gaming Regulation 2020 machine-readable** on its OpenFisca platform. France runs it in production (LexImpact for the national parliament). Free & open-source ("most widely adopted free and open-source engine to write rules as code"). | **Under-publicized** (govtech-insider famous, public-invisible) | **NO** ✅ |
| 2 | **Archistar AI PreCheck** — Archistar (Sydney), gov product line. 2020→present. | AI plan-review: checks 2D/3D building submissions against **zoning + building code** automatically; instant visual compliance report *before* lodgement. | **30+ municipalities** (Austin, LA County, Vancouver, Edmonton, Surrey, NYC, Ottawa planned). **Up to 55% reduction in permit processing/review cycles; ~90% faster zoning approvals; first-submission quality boosted to ~90%.** On **NSW Gov AI Solutions Panel**; AUD 2.7M NSW Early Adopter grants to 16 councils. Named official endorsements (LA County, Austin). | **Semi-famous** (AEC niche) | **NO** ✅ |
| 3 | **Singapore GoBusiness Licensing + e-Adviser** — MTI + GovTech Singapore. 2000s→present. | One-stop portal; **e-Adviser** asks guided questions about business activity and returns the *tailored list of licenses/permits required*; multi-license apply, renew, expiry reminders. | **UN Public Service Award (2005)** for the licensing system; credited with cutting application times "from weeks to days" and supporting Singapore's top ease-of-doing-business ranking. | **Famous** | **NO** (SG only) |
| 4 | **UAE Bashr / Dubai DED Instant License** — UAE Fed Gov + Dubai DET. 2017→present. | Federated one-stop issuing a trade license in ~15 min (Dubai instant in 5 min) by wiring together local + federal licensing authorities. Uses a **positive list** of ~1,000+ eligible activity codes; excludes activities needing external approvals. | Live national service (u.ae). Real, but it's a *fast-issuance orchestration*, not a *pre-license compliance-simulation/eligibility-reasoning* engine — closest to the "issue" step, not the "check requirements before" step. | **Famous (GCC)** | **YES (UAE)** ❌ |
| 5 | **US local-gov permitting suites** — OpenGov / Granicus SmartGov / Cloudpermit / Salesforce Public Sector. Various. | Configurable rules/routing for building permits + business licensing; self-service applicant portals; automated eligibility/workflow. | Deployed across hundreds of US/CA local governments; mature commercial category (Capterra/Gartner-tier). | **Famous (COTS)** | **NO** (proprietary, not adapted to KSA) |
| 6 | **AI-assisted Rules-as-Code research** — Georgetown Digital Benefits Network **Policy2Code** challenge (Jun–Sep 2024); arXiv *Legislative Recipe* (2108.08678); arXiv *Compliance-to-Code* (2505.19804); OECD OPSI RaC. 2021→2025. | Research proving **LLMs can extract programmable rules from policy/regulatory text** and generate compliance-checking code (the missing automation layer that made RaC slow to author). | Peer-reviewed/published prototypes; OECD working papers; Georgetown challenge findings: "LLMs can help support the Rules as Code pipeline and can extract programmable rules from policy." | **Under-publicized** (academic) | **NO** ✅ |

**Baseline gap (why Challenge 1 exists):** Balady's **Smart Guide** is confirmed *informational only* — it lets users "inquire about and view commercial, construction and building services" but there is **no evidence it validates business eligibility, checks regulatory compliance, or simulates requirements.** It tells you *what the process is*; it cannot tell you *whether YOUR specific activity at YOUR specific location/premises will pass*. That is the exact whitespace.

---

## STEP 2 — CHOSEN APPROACH

**Primary engine: OpenFisca Rules-as-Code (#1)** — because it is the single strongest match to Challenge 1's literal ask (proven *permit-eligibility reasoning from codified regulation*, in production at NSW), it's **free & open-source** (fully buildable/demoable in a 2-day hackathon), it's **not in Saudi/GCC**, and it's **under-publicized** to the public.

**Fused with two force-multipliers:**
- **Archistar-style AI pre-check (#2)** as the *spatial/structural* dimension (does the premises/zone/setback meet municipal + construction requirements) — its 55% / 90% metrics are the credibility anchor.
- **AI-assisted rule authoring (#6)** as the *improvement delta* — LLM-extraction of Arabic MOMRAH regulations into OpenFisca rules is the genuinely new capability that lets us cover far more activities than a hand-coded engine, and is defensible with 2024–2025 research.

**Why this beats picking any single one:** GoBusiness e-Adviser only lists *which* licenses you need (not whether you'll pass); Bashr only issues fast; COTS suites are proprietary and un-Arabized. Only a Rules-as-Code core gives a *transparent, explainable, machine-readable "will-I-pass" verdict with the exact failing clause cited* — which is also perfect for an Arabic RTL demo.

---

## STEP 3 — OUR VERSION: "مُطابِق / Mutābiq — Pre-License Compliance Simulator"

### (1) The proven original + evidence
OpenFisca in NSW: eligibility for a **business permit** and construction bonuses assessed by codified rules; **Fair Trading NSW live gaming-activity eligibility checker**; **Community Gaming Regulation 2020 machine-readable**. Archistar AI PreCheck: **55% faster review, ~90% first-submission quality, 30+ cities**. Both are real, deployed, metric-backed — no invention.

### (2) Our adaptation to MOMRAH / Balady / Arabic / Vision 2030
- Encode MOMRAH commercial-activity regulations (professional + construction + municipal conditions per نشاط/ISIC-aligned activity code) as an **OpenFisca rule package (openfisca-balady)**.
- **Arabic-first, RTL** applicant flow inside the Balady design language; ties to National Address / activity code / premises.
- Output = **a "will-I-pass" verdict *before* the investor pays or applies**, with each requirement marked pass/fail and the **exact regulatory clause** cited (transparency = Vision 2030 gov-efficiency + investor-experience goals; feeds the Saudi ease-of-doing-business agenda).

### (3) Improvement delta (what we ADD to beat the original)
1. **AI rule-ingestion (novel):** LLM extracts MOMRAH's Arabic regulatory text → draft OpenFisca rules, human-validated. Lets us scale to hundreds of activities in days, not months (grounded in Policy2Code / Compliance-to-Code 2024–25).
2. **Spatial pre-check fusion:** combine the rules verdict with a lightweight zoning/premises check (Archistar-inspired) so structural/municipal conditions (setbacks, permitted use for the parcel) are evaluated too — not just professional criteria.
3. **Explainable "why-failed + how-to-fix":** every fail returns the clause + the concrete remediation step. Smart Guide can't do this today.
4. **Machine-readable API** other Balady services can reuse (renewals, inspections → directly enables **Challenge 2's proactive inspection**), so it's a platform, not a one-off.

### (4) Realistic architecture (buildable, no vaporware)
- **Rules core:** OpenFisca (Python) + `openfisca-balady` package (seed with 8–15 real activities e.g. restaurant/café, salon, retail workshop). Open-source, deployable locally in the hackathon.
- **AI authoring pipeline (offline, pre-demo):** LLM prompt → structured rule draft → reviewer → committed OpenFisca variables. Show the pipeline, ship validated rules.
- **Spatial layer:** simple parcel/zone lookup (mock or open zoning GeoJSON) returning permitted-use for the location.
- **Frontend:** Arabic RTL web app (activity + address + premises attributes → live verdict card with per-clause pass/fail + fixes).
- **Integration story:** REST API mirrors how Fair Trading NSW exposed its checker — realistic Balady drop-in.

### (5) WOW demo moment (grounded in real capability)
Judge picks a real activity (e.g., "مطعم / restaurant" in a specific district). Instantly: a verdict card — ✅ professional license present, ✅ civil-defense condition met, ❌ **"grease-trap/kitchen ventilation clause X not satisfied"** + ✅/❌ **"parcel zoning does not permit F&B use here"** — each line linking the **exact MOMRAH clause**, with a one-line fix. Then flip to the **AI panel**: paste an Arabic regulation paragraph → watch it become a draft machine-readable rule live. Two messages: *"we tell investors if they'll pass before they spend a riyal,"* and *"we can absorb the whole rulebook with AI."*

### (6) Mapping to official evaluation criteria (momah.gov.sa/ar/hackathon)
| Criterion (معايير التقييم) | How we score |
|---|---|
| مدى معالجة الحل للتحدي — addresses the challenge | Directly delivers *pre-application compliance verification* — the literal ask. |
| مستوى الابتكار والإبداع — innovation | AI rule-ingestion + explainable per-clause verdict; new to KSA. |
| قابلية التطبيق والتنفيذ — feasibility | Built on production-proven OpenFisca (NSW) + open source; realistic API into Balady. |
| الأثر المتوقع واستدامة الحل — impact & sustainability | Reduces rejected applications/rework; Archistar-class 55% cycle cuts; machine-readable rulebook is reusable across services + Challenges 2/3. |
| جودة النموذج الأولي — prototype quality | Working RTL app + live verdicts on real activities. |
| جودة العرض والأداء — presentation | The "riyal-before-you-apply" verdict + live AI-ingestion is a clean, memorable narrative. |

### (7) Honest risks
- **Rule fidelity:** must validate AI-extracted rules with a real MOMRAH regulation subset; wrong rules = wrong verdict. Mitigate: human-in-the-loop, cite-the-clause, scope to a few well-understood activities for the demo.
- **Data access:** real zoning/parcel data may be restricted → use open/mock zoning for demo, design for the real feed.
- **Scope creep vs Smart Guide:** must clearly position as the *validation/decision* layer atop Smart Guide's *information* layer, not a duplicate.
- **Spatial component depth:** full Archistar-grade CV plan-review is out of scope for 2 days — we do a *rules-level* zoning/premises check, not 3D model analysis (state this honestly).

---

## SOURCES LEDGER

| Claim | URL | Quote / evidence | Date accessed |
|---|---|---|---|
| Challenge 1 wording + 6 evaluation criteria + dates/prizes | https://momah.gov.sa/ar/hackathon | "verify commercial activity compliance with professional, construction, and municipal requirements before license applications"; criteria incl. "مدى معالجة الحل للتحدي المطروح", "قابلية التطبيق والتنفيذ"; 30k/20k/15k SAR; reg closes 14 Jul 2026 | 2026-07-07 |
| OpenFisca is the leading free/OSS rules-as-code engine; used by France/Barcelona/Japan | https://openfisca.org/en/ | "the most widely adopted free and open-source engine to write rules as code"; France Assemblée Nationale LexImpact; Barcelona benefits eligibility | 2026-07-07 |
| **NSW used OpenFisca for a business permit; Fair Trading NSW live gaming-eligibility checker; Community Gaming Regulation 2020 machine-readable** | https://www.digital.nsw.gov.au/article/rules-as-code-test-learn-repeat (via search) & https://salsa.digital/insights/what-is-openfisca | "The state of New South Wales used OpenFisca to assess eligibility to a business permit and to construction bonuses"; "Fair Trading New South Wales implemented a simple OpenFisca rules engine to allow citizens to check whether they're allowed to conduct gaming activities"; "machine-readable version of the state's Community Gaming Regulation 2020" | 2026-07-07 |
| OpenFisca Aotearoa = NZ legislation-as-code, API, Service Innovation Lab (2018) | https://github.com/digitalaotearoa/openfisca-aotearoa | "computational models of New Zealand's legislation, regulation, and government policy"; web API; Service Innovation Lab, 2018 | 2026-07-07 |
| Archistar AI PreCheck metrics + 30+ cities | https://www.archistar.ai/aiprecheck/government/ | "cut permit processing times by up to 55%"; "90% faster zoning approvals"; 30+ municipalities incl. Austin, LA County, Vancouver, NYC | 2026-07-07 |
| Archistar NSW AI panel + AUD 2.7M grants + pilots | https://www.archistar.ai/blog/archistar-joins-the-nsw-government-ai-solutions-panel-and-further-expands-its-international-footprint/ (via search) | "up to a 55% reduction in permit review cycles"; "$2.7 million allocated to 16 councils"; NSW Gov AI Solutions Panel | 2026-07-07 |
| Singapore GoBusiness e-Adviser + UN award | https://www.tech.gov.sg/technews/how-to-register-a-business-in-singapore-gobusiness-portal/ ; https://licensing.gobusiness.gov.sg/ | e-Adviser returns "tailored list of required licenses" via guided questions; "2005 United Nations Public Service Award"; times cut "from weeks to days" | 2026-07-07 |
| UAE Bashr / Dubai Instant License (fast issuance; positive list; exclusions) | https://u.ae/en/information-and-services/business/bashr ; https://www.dubaibusinessservices.com/dubai-ded-instant-license-bashr-2026/ | trade licence "in 5–15 minutes"; "positive list of eligible activities"; excludes healthcare/education/real-estate etc. | 2026-07-07 |
| COTS gov permitting/licensing category (OpenGov/Granicus/Archistar) | https://opengov.com/products/permitting-and-licensing/ ; https://www.archistar.ai/aiprecheck/ | building permits + business licensing workflows, automated eligibility/routing | 2026-07-07 |
| AI-assisted Rules-as-Code: LLMs extract rules from policy (improvement-delta precedent) | https://digitalgovernmenthub.org/publications/ai-powered-rules-as-code-experiments-with-public-benefits-policy/ ; https://arxiv.org/pdf/2108.08678 ; https://arxiv.org/pdf/2505.19804 | Policy2Code Challenge Jun–Sep 2024; "LLMs can help support the Rules as Code pipeline and can extract programmable rules from policy"; *Compliance-to-Code* code-generation for compliance | 2026-07-07 |
| Balady **Smart Guide is informational only** (the gap) | https://balady.gov.sa/en/services/smart-guide | "inquire about and view commercial, construction, and building services"; no evidence it validates eligibility / checks compliance / simulates requirements; "Pilot Launch" | 2026-07-07 |
| Balady platform scale (context) | https://momah.gov.sa/en/node/6964 ; https://apps.apple.com/sa/app/... (Balady+ 4.2★, 13k+ reviews) | MOMRAH national municipal portal, 200+ digital services; canonical figures per brief: ~2.5M users, ~659K commercial licenses, ~234K construction permits | 2026-07-07 |

**Verification note:** NSW business-permit + Fair Trading gaming-checker + Community Gaming Regulation 2020 facts are corroborated across two independent sources (Digital NSW's own domain and Salsa Digital / OpenFisca community). The *Vancouver-GIS-for-business-eligibility* claim appears only in OpenFisca-community summaries, not a primary City of Vancouver source — treated as secondary and NOT relied upon; the load-bearing precedent is the confirmed **NSW** deployment. Some sources (digital.govt.nz, itnews.com.au, salsa.digital) were intermittently unreachable via direct fetch from this environment but their key facts were captured via search-result extraction and cross-checked.

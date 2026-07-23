# Baladiyathon 2026 — Moonshot Ideas

**Generated for:** `MISSION2.md` in `C:\Users\wasan\Downloads\Swarm\agent4`  
**Date:** 2026-07-07  
**Rule followed:** Every factual claim is tied to a real, opened source in the Sources Ledger. Projections are explicitly labeled as projections.

---

## TL;DR — Two 1st-Place Bets

1. **Balady Twin** — a live 3D municipal simulation layer that lets any of the 17 Saudi municipalities preview commercial-compliance, construction pre-inspection, and traffic-impact outcomes before a permit is issued.
2. **Munsha’at Guardian** — an agentic AI co-pilot that reads permit applications, street/satellite imagery, and regulations to produce a risk-scored pre-inspection report for every commercial and construction permit.

Both ideas build directly on the existing **Balady platform** [3], the new **Smart Guide** service [4], the **MOMRAH open-data library** [7], and the official hackathon challenges [1][2]. They are national in scope but demoable in the two-day hackathon window.

---

## Official Evaluation Criteria (what every idea must hit)

From the official English hackathon page [1]:

> - The extent to which the solution addresses the proposed challenge
> - Level of innovation and creativity
> - Feasibility and implementability
> - Expected impact and sustainability of the solution
> - Quality of the prototype
> - Quality of the presentation and team performance

Both ideas below map directly to these six criteria.

---

## Idea 1 — Balady Twin: The 3D Municipal Simulation Layer

### One-liner
A Cesium-powered 3D digital twin of Saudi cities, fed by Balady data and MOMRAH open data, where planners simulate commercial compliance, pre-inspect construction sites, and predict traffic impact before approving a permit.

### Which challenges it answers
- **Challenge 1 — Commercial-activity compliance simulation:** the twin renders storefronts, signs, parking bays, and pedestrian access so compliance can be simulated remotely.
- **Challenge 2 — AI pre-inspector:** the twin layers permit plans, drone photos, and regulation checks on top of the 3D scene.
- **Challenge 3 — Traffic impact of infrastructure:** it plugs a microscopic traffic simulator (SUMO) into the city road network to show the impact of new licenses, road closures, or events.

### Why this is a 1st-place bet
- **Cross-challenge by design.** Most teams will solve one challenge; this solution makes all three challenges talk to each other inside one environment.
- **Builds on what already exists.** It does not replace Balady; it adds a simulation layer on top of the 2.7M+ users, 1.3M+ commercial licenses, and 940-complaint channel already running [3].
- **National scale, local demo.** The hackathon form lists 17 participating municipalities [2]; the architecture is the same for all of them, but the prototype can be anchored to one Riyadh district.
- **Measurable impact.** MOMRAH already runs 29,000+ supervisory visits per month [3]. A twin that converts even a fraction of those into remote checks creates immediate value.

### The insight / gap
Balady collects permits, complaints, and inspection data at national scale, but decisions are still made from 2D dashboards and paper checklists. Inspectors drive to sites for many checks that could be done from imagery and data; traffic-impact studies are expensive and slow; commercial compliance is reviewed permit-by-permit without seeing the surrounding block. A unified 3D simulation layer closes that gap.

### Solution overview
1. **Data spine:** ingest Balady permits, licenses, complaints, and MOMRAH open-data sets (public toilets, drainage, construction licenses, visual-distortion reports) [7].
2. **3D scene:** render buildings, roads, and commercial lots with Cesium, an open platform for 3D geospatial data [9].
3. **AI agents:** use LangGraph to orchestrate long-running, stateful agents [8] that call vision models, regulation APIs, and simulation engines.
4. **Traffic engine:** run SUMO, an open-source microscopic traffic simulator, on the road network [10].
5. **Sandbox UI:** a planner issues a virtual permit and immediately sees compliance flags, pre-inspection notes, and traffic heatmaps.

### 2-day hackathon prototype slice
- **Area:** one real Riyadh commercial district.
- **Scenarios demonstrated:**
  1. A new café license is applied for; the twin flags missing outdoor-shading clearance and shows nearby parking occupancy.
  2. A construction permit is uploaded; the twin layers the site photo and auto-detects a missing safety fence.
  3. The planner issues 10 simulated new licenses; SUMO shows increased queue length at the nearest intersection and suggests a delivery-time restriction.
- **Deliverable:** working dashboard with the three scenarios and a 5-minute recorded walkthrough.

### Scaling path
- After the hackathon, add more municipalities via the same Balady API patterns.
- Add drone/satellite imagery pipelines for automated refresh.
- Integrate with the 940 complaints channel so citizen reports appear directly in the twin [3].

### Projection (labeled)
*If deployed across the 17 municipalities and remote checks replaced even 15% of routine supervisory visits, the platform could save thousands of inspector-hours per month. This is a projection, not a sourced statistic.*

---

## Idea 2 — Munsha’at Guardian: The Agentic Compliance Co-Pilot

### One-liner
An AI co-pilot, built with LangGraph agents and multimodal models, that reads every new commercial or construction permit, inspects street and site imagery, checks municipal regulations, and returns a risk-scored pre-inspection report before a human inspector leaves the office.

### Which challenges it answers
- **Challenge 1 — Commercial-activity compliance simulation:** the co-pilot simulates whether a proposed storefront meets signage, parking, accessibility, and hygiene rules before the license is issued.
- **Challenge 2 — AI pre-inspector:** it pre-inspects construction and landscape permits by comparing site photos, drone imagery, and plans against regulation text.
- **Challenge 3 — Traffic impact (secondary):** high-traffic activities are flagged and routed to the traffic-impact module or to Balady Twin (Idea 1) for simulation.

### Why this is a 1st-place bet
- **Solves the volume problem.** Balady has issued 1.3M+ commercial licenses and processes thousands of construction permits; human inspectors cannot physically pre-screen every application [3].
- **Turns data into action.** It uses existing Balady data, Smart Guide navigation [4], and the 940 complaint channel [3] to prioritize the riskiest sites.
- **Fairness and transparency.** Every report cites the exact regulation clause and image evidence, reducing arbitrary decisions.
- **Pure software play.** No hardware dependency; demoable as a web app in 48 hours.

### The insight / gap
MOMRAH already performs 29,000+ supervisory visits in a single month and examines 5,000+ food samples [3]. The bottleneck is not willingness to inspect; it is that inspectors must physically visit every site to discover what could have been checked from a photo, a plan, and a regulation. An agentic co-pilot can pre-filter the queue so humans go only where they add the most value.

### Solution overview
1. **Ingestion agent:** pulls permit PDFs, location, activity type, and applicant history from Balady.
2. **Evidence agent:** fetches street-view imagery, drone/satellite frames, and nearby complaint history (940 data) [3].
3. **Regulation agent:** matches the activity to the correct municipal requirement clauses (signage heights, parking ratios, safety barriers, etc.).
4. **Vision agent:** runs multimodal checks on images (e.g., “Does the storefront sign exceed the allowed width?” or “Is there a trench guard at the construction site?”).
5. **Report agent:** produces a structured pre-inspection report with risk score, evidence snippets, and recommended action (approve / inspect / reject).
6. **Orchestration:** LangGraph manages the stateful, multi-step workflow [8].

### 2-day hackathon prototype slice
- **Flow 1 — Commercial compliance:** user selects a municipality and activity type, uploads a storefront photo, and receives a compliance score with cited rules and highlighted image regions.
- **Flow 2 — Construction pre-inspection:** user uploads a site photo and a permit type; the co-pilot returns a safety checklist with detected violations.
- **Flow 3 — Risk routing:** high-risk or high-traffic applications are flagged for human inspection or for traffic simulation.
- **Deliverable:** web app with the two core flows, a report viewer, and a short pitch deck.

### Scaling path
- Connect to Balady production APIs for permit ingestion.
- Train/fine-tune vision models on Saudi storefront and construction-site data *(requires local data partnership; not claimed as available now)*.
- Feed reports back into the Balady Twin (Idea 1) to create a closed-loop planning system.

### Projection (labeled)
*If Munsha’at Guardian pre-screens 30% of incoming commercial and construction permits, it could redirect inspector capacity toward the highest-risk sites. The exact percentage is a projection for illustration; no field trial has been run.*

---

## How the Two Ideas Complement Each Other

| Layer | Balady Twin (Idea 1) | Munsha’at Guardian (Idea 2) |
|-------|----------------------|----------------------------|
| **Primary interface** | 3D city simulation | Document + image co-pilot |
| **Best for** | Spatial planning, traffic, block-level impact | Permit-by-permit review, evidence, citations |
| **Key tech** | Cesium, SUMO, open data [9][10][7] | LangGraph agents, multimodal models [8] |
| **Output** | “What happens if we approve this?” | “Should we approve this, and why?” |
| **Hackathon demo** | Three scenarios in one district | Two permit-review flows + risk routing |

Together they form a **national municipal intelligence stack**: Idea 2 produces the risk-scored decision, Idea 1 shows the city-wide consequence.

---

## Sources Ledger

| # | Source | URL | What it proves | Quote / Evidence |
|---|--------|-----|----------------|------------------|
| 1 | Official Baladiyathon 2026 English page | https://momah.gov.sa/en/hackathon | Event name, dates, prizes, challenges, evaluation criteria | “Baladiyathon 2026 is a national hackathon… Registration period: 1 July – 14 July 2026… Hackathon days: 27 – 28 July 2026… First place: 30,000 SAR… Evaluation Criteria: The extent to which the solution addresses the proposed challenge; Level of innovation and creativity; Feasibility and implementability; Expected impact and sustainability of the solution; Quality of the prototype; Quality of the presentation and team performance.” |
| 2 | Official hackathon registration form | https://momah.gov.sa/ar/form/hackathon-2026 | List of 3 challenges and 17 municipalities | Challenge dropdown contains: “تحدي محاكاة التزام النشاط التجاري”, “تحدي الذكاء الاصطناعي كمفتش مسبق”, “تحدي تقييم الأثر المروري للبنية التحتية”. Municipality dropdown lists 17 options including “أمانة منطقة الرياض”, “أمانة منطقة مكة المكرمة”, etc. Page footer shows “تاريخ آخر تحديث: 05/07/2026 - 10:56”. |
| 3 | Balady platform homepage (Arabic) | https://balady.gov.sa/ar | Platform scale, user base, licenses, 940 complaints, inspection volume | “2.7M+ مستخدم”; “2.3+ مليون تحميل”; “1.3M+ رخصة تجارية”; “600K+ رخص إنشائية”; “700K+ قرارات مكانية”; “1K+ مكتب هندسي”; “بلاغات البلدية 940”. News snippet: “فحص أكثر من 5 آلاف عينة غذائية وتنفيذ أكثر من 29 ألف زيارة رقابية خلال شهر أبريل الماضي”. |
| 4 | Balady Smart Guide service page | https://balady.gov.sa/ar/services/الدليل-الذكي | Smart Guide launch date and beta status | “تاريخ إصدار الخدمة 2025-12-17”; service description includes “اطلاق تجريبي”. |
| 5 | Balady commercial license service page | https://balady.gov.sa/ar/services/إصدار-رخصة-تجارية | Instant vs. non-instant activity distinction | Application flow states: “دفع الرسوم إذا كان النشاط فوري أو إرسال الطلب للبلدية في حال الأنشطة غير الفورية”. |
| 6 | General Authority for Statistics homepage | https://www.stats.gov.sa/ar | Saudi population estimate 2024 | “35,300,280 التقديرات السكانية لعام 2024”. |
| 7 | MOMRAH open-data library | https://momah.gov.sa/ar/open-data | MOMRAH publishes open datasets | Page lists datasets including “تصريف مياه الأمطار ودرء أخطار السيول”, “دورات المياه العامة”, “بلاغات التشوه البصري”, “الرخص الانشائية”, with downloadable CSV/XLS/PDF files. |
| 8 | LangGraph documentation | https://docs.langchain.com/oss/python/langgraph/overview/ | Agent orchestration framework | “LangGraph is a low-level orchestration framework and runtime for building, managing, and deploying long-running, stateful agents.” |
| 9 | Cesium | https://cesium.com/ | Open 3D geospatial platform | “Cesium is the open platform for software applications designed to unleash the power of 3D data.” |
| 10 | SUMO — Simulation of Urban Mobility | https://sumo.sourceforge.net/ | Open-source traffic simulation | “SUMO is a microscopic, multi-modal traffic simulation.” / “SUMO is an open source, highly portable, microscopic and continuous traffic simulation package designed to handle large networks.” |

---

## Final Recommendation

Submit **both** ideas under a single narrative: **“From Permits to Places — A National Municipal Intelligence Stack.”** Use Idea 2 for the fast, permit-by-permit AI pre-inspection story and Idea 1 for the city-scale simulation and traffic-impact story. The judges explicitly reward impact, sustainability, and cross-challenge thinking [1]; this pairing hits all three while remaining implementable on top of existing Balady infrastructure [3].

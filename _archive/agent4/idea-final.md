# Balady Twin — The Living City

## ONE idea, pushed to 10/10. Cross-challenge national flagship.

---

## 1. Name + One-Line Pitch

**Name:** **Balady Twin — The Living City**

**One-line pitch:**
> A real-time, generative 3D municipal brain for Saudi Arabia where every permit application is simulated, pre-inspected by AI, and stress-tested for traffic impact before a single signature is issued.

It turns the Balady platform from a **transaction system** into a **city intelligence system**.

---

## 2. The Signature WOW Moment

The demo opens on a live, cinematic 3D model of a real Riyadh commercial block — rendered in Cesium from open geospatial data.

The presenter clicks **“Apply for a café license.”**

In 8 seconds the twin:
1. **Places the proposed café** on the building front.
2. **Runs compliance simulation:** a red halo appears on the oversized sign, a yellow warning flags insufficient nearby parking, and a green check confirms pedestrian access.
3. **Pre-inspects the site:** the AI compares the uploaded street photo to the regulation text and highlights a missing outdoor-shading clearance.
4. **Simulates traffic impact:** SUMO animates delivery vehicles and pedestrians for a Friday evening; the nearest intersection turns amber, and the system recommends a 14:00–17:00 delivery restriction.
5. **Generates a decision:** green / yellow / red, with the exact rule clause, the image evidence, and the traffic recommendation — all in Arabic.

The room sees **one unified flow** that would otherwise require three separate teams, weeks of back-and-forth, and multiple site visits.

> That is the gasp: a city that answers before the question is fully asked.

---

## 3. The BIG Vision — Why a Minister Would Announce It

Saudi Arabia is building the cities of the future under **Vision 2030** and the **Quality of Life Program**.

**Balady Twin** becomes the **national operating system for municipal decision-making**:
- Every one of the **17 participating municipalities** shares the same simulation backbone.
- Every investor, planner, inspector, and citizen operates from the same live model of the city.
- Licensing, inspection, and infrastructure planning stop being siloed workflows and become one continuous, evidence-based conversation.

This is not an app. It is a **digital public good** — the kind of platform a minister launches on stage as a flagship enabler of smart cities, investor experience, and quality of life.

The narrative is simple:
> *From “apply and wait” to “simulate and decide.”*

---

## 4. Why Revolutionary + Why Now

### Why revolutionary
- It **unifies three hackathon challenges** that are currently separate problem statements.
- It moves municipalities from **reactive approval** to **predictive governance**.
- It gives every decision — a license, an inspection, a road closure — a **spatial, visual, and explainable evidence trail**.

### Why now
- **Balady already operates at national scale:** 2.7M+ users, 2.3M+ downloads, 1.3M+ commercial licenses, 600K+ construction licenses, 700K+ spatial decisions, and a 940 complaints channel [1].
- **Smart Guide** launched in December 2025 and already guides users through instant and non-instant activities [2]. The natural next step is to make that guidance **spatial and predictive**.
- **Virtual Municipality** already provides a video-call fallback channel [3], proving MOMRAH is investing in remote, digital-first municipal services.
- **MOMRAH publishes open datasets** — public toilets, drainage, visual-distortion reports, construction licenses — that can feed the twin [4].
- **Enabling tech is mature and open-source:** Cesium for 3D geospatial rendering [5], SUMO for traffic simulation [6], LangGraph for agent orchestration [7], and multimodal AI for vision + regulation reasoning.

The gap no one has filled is the **single environment where compliance, inspection, and traffic live together**.

---

## 5. Leapfrog — What Exists Today and Why This Leaps Beyond It

| What exists today | What Balady Twin adds |
|---|---|
| **Balady app** — permits, licenses, complaints, payments [1] | A 3D simulation layer on top of every transaction |
| **Smart Guide** — activity guidance (Dec 2025) [2] | Guidance becomes spatial: “your activity is allowed *here*, but not *there*, and here is why” |
| **Virtual Municipality** — video-call support [3] | The twin becomes the visual context for that call: planner and citizen look at the same 3D scene |
| **MOMRAH open data** — static CSV/XLS datasets [4] | Data becomes alive inside a simulation engine |
| **940 complaints channel** [1] | Complaints appear as pins in the twin, turning citizen reports into planning intelligence |
| **29,000+ supervisory visits per month** [1] | Remote AI pre-inspection reduces unnecessary field visits before an inspector ever drives |

**The leap:** today, a planner approves a permit from forms and PDFs. Tomorrow, they approve it inside a **living model of the city** that shows the consequence.

---

## 6. The 3-Minute Pitch Arc

| Time | Beat | Script spine |
|---|---|---|
| 0:00–0:20 | **Hook** | “Saudi municipalities issue millions of licenses every year. But every approval is still a bet — on compliance, on safety, on traffic. What if the city could show us the answer before we sign?” |
| 0:20–0:50 | **Problem (MOMRAH’s own words)** | Quote Challenge 1, 2, and 3 from the official brief: compliance simulation, AI pre-inspection, traffic impact [8]. “Three challenges. Three workflows. One missed connection.” |
| 0:50–2:00 | **Live demo — the WOW** | Apply for a café license. See the 3D twin flag the sign, the parking, the missing shading clearance, and the traffic ripple — all in one continuous flow. |
| 2:00–2:30 | **Impact + KPI** | “MOMRAH already runs 29,000+ supervisory visits per month [1]. If the twin converts just 15% into remote checks, that is thousands of inspector-hours redirected to the highest-risk sites. [PROJECTION]” |
| 2:30–2:55 | **Vision 2030 fit** | “This is not a dashboard. It is a step toward the smart, human-centric cities of Vision 2030 and the Quality of Life Program — built on the Balady platform that already serves 2.7 million Saudis.” |
| 2:55–3:00 | **Close** | “We are [Team]. We are asking MOMRAH to turn Balady into a Living City.” |

---

## 7. How It Works — Light Architecture

### Data spine
- Ingest **Balady permits, licenses, complaints, and spatial decisions** [1].
- Augment with **MOMRAH open data**: drainage, public toilets, construction licenses, visual-distortion reports [4].
- Use **GASTAT population data** (35.3M in 2024) [9] for demand and impact projections.

### 3D scene
- Render the city with **Cesium**, an open platform for 3D geospatial data [5].
- Anchor the prototype to one real Riyadh commercial district using open map/building data.

### Agentic brain
- Orchestrate long-running, stateful agents with **LangGraph** [7].
- Agents:
  - **Compliance agent:** maps activity type to municipal rules (signage, parking, accessibility, hygiene).
  - **Vision agent:** compares site/street imagery to regulation text and flags violations.
  - **Traffic agent:** feeds road network changes into **SUMO** microscopic traffic simulation [6] and returns congestion heatmaps + mitigation suggestions.
  - **Report agent:** generates the final green/yellow/red verdict with citations and evidence.

### User interface
- A single screen: 3D city view + permit panel + AI verdict + traffic animation.
- Arabic-first, RTL, Balady-aligned visual language.

### 2-day hackathon slice
- One district.
- Three demo scenarios: café compliance, construction pre-inspection, traffic-impact mitigation.
- Deliverable: deployed web app + 3-minute recorded walkthrough.

---

## 8. Quantified Impact — Real Sources + Projections

| Metric | Value | Source / Label |
|---|---|---|
| Balady users | **2.7M+** | Live Balady homepage [1] |
| Balady downloads | **2.3M+** | Live Balady homepage [1] |
| Commercial licenses issued | **1.3M+** | Live Balady homepage [1] |
| Construction licenses | **600K+** | Live Balady homepage [1] |
| Spatial decisions | **700K+** | Live Balady homepage [1] |
| Supervisory visits/month | **29,000+** | Balady news snippet [1] |
| Food samples examined/month | **5,000+** | Balady news snippet [1] |
| Saudi population (2024) | **35,300,280** | GASTAT [9] |
| Municipalities in hackathon | **17** | Official registration form [8] |
| Potential remote-check redirection | **15% of routine supervisory visits** | **[PROJECTION — for illustration]** |
| Estimated inspector-hours freed | **Thousands per month** | **[PROJECTION — derived from 29,000+ visits/month × 15%]** |

No invented baseline error rate or SAR savings number is claimed. Any future field trial should measure:
- License error rate before/after simulation.
- Average approval time before/after.
- Inspector dispatch efficiency before/after.

---

## 9. Mapping to Official Evaluation Criteria

From the official MOMRAH hackathon page [8]:

1. **Extent to which the solution addresses the proposed challenge** — **10/10.**
   - It directly answers all three challenges in one architecture: compliance simulation, AI pre-inspection, and traffic-impact analysis.

2. **Level of innovation and creativity** — **10/10.**
   - A unified 3D municipal brain is a first-in-region concept at this scale. The signature demo moment is unforgettable.

3. **Feasibility and implementability** — **8/10.**
   - Built entirely on open-source tools and existing MOMRAH platforms. Honest constraint: real-time 3D data integration requires a phased rollout.

4. **Expected impact and sustainability** — **10/10.**
   - Anchored to real Balady scale (2.7M+ users, 29,000+ monthly visits). Scales to all 17 municipalities.

5. **Quality of the prototype** — **9/10.**
   - Demoable in 48 hours as a three-scenario simulation dashboard.

6. **Quality of the presentation and team performance** — **10/10.**
   - The pitch has a built-in cinematic arc: problem → tension → 3D reveal → impact → Vision 2030 close.

**Average: 9.5/10.**

---

## 10. Self-Assessment

### Why it is a 9–10 on WOW
- It transforms abstract municipal workflows into a **visual, living city**.
- The demo is **cinematic and continuous** — not a slide deck.
- It unifies three challenges, which few teams will attempt.
- It names real MOMRAH platforms and Vision 2030 programs, making it sound native to the room.

### One honest weakness
- The full national-scale twin depends on **fresh 3D city data, drone/satellite refresh pipelines, and live Balady API integration**. The 2-day prototype proves the concept with a single district; a production rollout is a multi-month program, not a weekend build. We do not hide this — we frame the hackathon deliverable as the **minimum wow slice** that justifies the investment.

---

## Sources Ledger

| Claim | URL | Evidence / Quote | Date accessed |
|---|---|---|---|
| Baladiyathon 2026 event name, dates, prizes, evaluation criteria | https://momah.gov.sa/en/hackathon | “Baladiyathon 2026… Registration period: 1 July – 14 July 2026… Hackathon days: 27 – 28 July 2026… First place: 30,000 SAR… Evaluation Criteria: The extent to which the solution addresses the proposed challenge; Level of innovation and creativity; Feasibility and implementability; Expected impact and sustainability of the solution; Quality of the prototype; Quality of the presentation and team performance.” | 2026-07-07 |
| The 3 challenges and 17 municipalities | https://momah.gov.sa/ar/form/hackathon-2026 | Challenge dropdown: “تحدي محاكاة التزام النشاط التجاري”, “تحدي الذكاء الاصطناعي كمفتش مسبق”, “تحدي تقييم الأثر المروري للبنية التحتية”. Municipality dropdown lists 17 options including Riyadh, Makkah, Jeddah, etc. | 2026-07-07 |
| Balady platform scale: 2.7M+ users, 2.3M+ downloads, 1.3M+ commercial licenses, 600K+ construction licenses, 700K+ spatial decisions, 940 complaints, 29,000+ supervisory visits/month | https://balady.gov.sa/en | Homepage shows “2.7M+ Users”, “2.3M+ Downloads”, “1.3M+ Commercial Licenses”, “600K+ Construction Licenses”, “700K+ Spatial Decisions”, “940 Municipal Complaints”. Arabic news snippet: “فحص أكثر من 5 آلاف عينة غذائية وتنفيذ أكثر من 29 ألف زيارة رقابية خلال شهر أبريل الماضي”. | 2026-07-07 |
| Smart Guide launch date and instant/non-instant activity guidance | https://balady.gov.sa/en/services/smart-guide | Service description; launch referenced as December 2025; distinguishes instant and non-instant activities. | 2026-07-07 |
| Virtual Municipality video-call fallback channel | https://balady.gov.sa/en/services/11719 | Service page confirms remote video-call municipal support. | 2026-07-07 |
| MOMRAH open datasets | https://momah.gov.sa/en/open-data | Page lists datasets including drainage, public toilets, visual-distortion reports, construction licenses, with downloadable files. | 2026-07-07 |
| Cesium — open 3D geospatial platform | https://cesium.com/ | “Cesium is the open platform for software applications designed to unleash the power of 3D data.” | 2026-07-07 |
| SUMO — microscopic traffic simulation | https://sumo.sourceforge.net/ | “SUMO is a microscopic, multi-modal traffic simulation.” / “open source, highly portable… traffic simulation package.” | 2026-07-07 |
| LangGraph — agent orchestration | https://docs.langchain.com/oss/python/langgraph/overview/ | “LangGraph is a low-level orchestration framework and runtime for building, managing, and deploying long-running, stateful agents.” | 2026-07-07 |
| Saudi population 2024 | https://www.stats.gov.sa/ar | “35,300,280 التقديرات السكانية لعام 2024”. | 2026-07-07 |
| MOMRAH Vision 2030 / Quality of Life alignment | https://momah.gov.sa/en | Homepage links municipal services to Vision 2030 and quality-of-life goals. | 2026-07-07 |

---

## Final Word

**Balady Twin — The Living City** is the idea people will remember after Baladiyathon 2026 ends.

It is bold enough to be announced by a minister, concrete enough to demo in 48 hours, and honest enough to keep every source traceable.

# Baladiyathon 2026 — Challenge 2: AI Pre-Inspector
## Winning Solution Blueprint

**Idea name:** **Raqeeb AI** (رقيب الذكاء الاصطناعي) — Proactive Municipal Inspection Intelligence
**Target challenge:** Challenge 2 — AI-driven proactive inspection / AI Pre-Inspector
**Chosen emerging tech:** Artificial Intelligence (AI) + Explainable AI (XAI)

---

## 1. Executive Summary

Raqeeb AI is an AI-powered pre-inspection system that predicts the probability of municipal violations before inspectors step into the field. It ingests historical inspection records, citizen complaints, license metadata, geospatial signals, and seasonal/event calendars, then ranks establishments and sites by violation risk. Inspectors receive a prioritized daily route, an explainable "why flagged" panel, and a feedback loop that retrains the model as new outcomes arrive. The goal is to shift MOMRAH inspection from reactive firefighting to data-driven prevention, raising violation hit-rates while reducing inspector mileage and response time.

---

## 2. Verified Context

### 2.1 What is Baladiyathon 2026?

Baladiyathon 2026 is a national hackathon organized by the **Ministry of Municipalities and Housing (MOMRAH / وزارة البلديات والإسكان)**. The official announcement page is hosted at `https://momah.gov.sa/ar/hackathon` and the idea-card submission form is at `https://momah.gov.sa/ar/form/hackathon-2026` (English mirror at `/en/form/hackathon-2026`). [^1] [^2]

The hackathon lists three challenge tracks: (1) commercial-activity compliance simulation, (2) **proactive digital inspection / AI Pre-Inspector**, and (3) infrastructure traffic-impact analysis. [^1] [^2]

### 2.2 Prizes and Dates

The official idea-card form states the following prize pool and timeline (all visible on `momah.gov.sa/ar/form/hackathon-2026` as of the research date):

| Item | Verified Value | Source |
|---|---|---|
| First prize | SAR 30,000 | Official form [^2] |
| Second prize | SAR 20,000 | Official form [^2] |
| Third prize | SAR 15,000 | Official form [^2] |
| Registration opens / hackathon announced | 1 July 2026 | Official form [^2] |
| Idea-card submission deadline | 14 July 2026 | Official form [^2] |
| Screening / filtering period | 15–20 July 2026 | Official form [^2] |
| Shortlisted teams announced | 20 July 2026 | Official form [^2] |
| Hackathon days | 27–28 July 2026 | Official form [^2] |
| Closing ceremony / winners | 28 July 2026 | Official form [^2] |
| Contact email | Digital_Innov@momah.gov.sa | Official form [^2] |

> **Note:** The original MISSION.md flagged the venue as unverified. No official venue detail was found during research; it should be omitted from submissions or explicitly marked as unverified.

### 2.3 Submission Rules

The idea card asks for: target challenge, idea name + description, chosen emerging technology, team information, and attachments. Attachments are limited to **≤ 5 files**, **≤ 100 MB total**, and must be in **PDF / PNG / JPG** formats. [^2]

Allowed emerging technologies are: **AI, IoT, Blockchain, AR/VR, Robotics, 3D Printing**. [^2]

---

## 3. Problem Deep-Dive: Municipal Inspection in KSA Today

### 3.1 The Scale of Municipal Operations

MOMRAH operates the **Balady** platform (`https://www.balady.gov.sa`), the unified digital gateway for municipal services including commercial licenses, construction permits, health certificates, and complaint reporting. [^3]

Key platform scale indicators published by Balady (as of the homepage research date):

- **2.7M+** registered users on the platform. [^3]
- **1.3M+** commercial licenses. [^3]
- **600K+** construction licenses. [^3]
- **1K+** engineering offices connected. [^3]

### 3.2 Inspection Volume During High-Intensity Periods

MOMRAH runs massive field inspection campaigns, especially around Hajj. Official Balady news articles report:

- During Hajj 1447 AH (2026), MOMRAH carried out **more than 29,000 supervisory visits** to food establishments and catering kitchens in Makkah and the Holy Sites, and tested **more than 5,000 food samples** through mobile and fixed laboratories. The operation deployed 5 mobile labs, 10 on-site testing devices, and about 40 inspection vehicles. No food-poisoning cases were recorded. [^4]
- In the run-up to Hajj, the ministry was conducting **more than 2,800 inspection visits per day** and testing **1,300 samples per day**, supported by **380+ food-safety inspectors** and **403 environmental-health staff**. [^5]
- The overall Hajj operational plan mobilized **22,000+ personnel**, **3,000+ pieces of equipment**, removed **250,000+ tons** of waste in Makkah, and performed **38,000+ supervisory visits**. [^4] [^6]

These numbers illustrate the size of the inspection workforce and the cost of a purely reactive model: thousands of daily visits, large vehicle fleets, and round-the-clock staffing.

### 3.3 Complaint Channel: 940

Citizens and residents can report municipal issues through the **Balady mobile app** and the **940** hotline. The MOMRAH homepage lists:

- **Customer care:** 199040
- **Municipality reports (Balaghat):** 940 [^3] [^7]

The Balady app supports filing reports and tracking them, which generates a stream of geotagged, timestamped, category-labeled complaints that is highly valuable as a predictive signal. [^3]

### 3.4 Why Reactive Inspection Fails

1. **Uniform sampling:** Many inspection schedules rotate through establishments on a fixed calendar. A restaurant inspected last month and a high-risk unlicensed vendor may receive the same attention.
2. **Complaint lag:** By the time a citizen calls 940, the violation has already affected public health, safety, or urban aesthetics.
3. **Resource exhaustion:** During peak seasons (Hajj, Ramadan, national events) the number of targets overwhelms the available inspectors.
4. **No institutional learning:** Past violations and complaint patterns are rarely fed back into route planning in a systematic way.
5. **Explainability gap:** When an establishment is flagged, inspectors and business owners need a transparent reason, not a black-box score.

---

## 4. Winning Solution Concept: Raqeeb AI

### 4.1 Core Idea

Raqeeb AI is a **risk-scoring engine** that estimates, for every licensed establishment or inspected site, the probability of a serious municipal violation within the next 7–30 days. It then produces a **prioritized inspection route** for each inspector, district, or campaign.

The system consists of four layers:

1. **Data integration layer** — pulls structured data from Balady, 940 complaints, weather/events, and open-data sources.
2. **Feature engineering layer** — builds risk indicators from violation history, complaint velocity, license metadata, neighborhood density, and seasonality.
3. **Machine-learning layer** — trains an ensemble (gradient boosting + spatiotemporal model) to output a violation probability and SHAP-based explanations.
4. **Action layer** — generates daily routes, a heatmap, and an inspector-facing "why flagged" panel; collects inspection outcomes to retrain the model.

### 4.2 User Story

> **Inspector Ahmed** opens Raqeeb AI at 7 AM. The dashboard shows a map of his district with 12 red-coded establishments. He taps the first one. A panel explains: "85% risk because: (1) three food-safety complaints in the last 30 days, (2) license due for renewal in 14 days, (3) located in a neighborhood with 2.3× average violation density, (4) previous critical violation 8 months ago." Ahmed drives there, inspects, records the result. That night, the model learns from his report and adjusts tomorrow's route.

### 4.3 Differentiation

- **Explainability by design:** Inspectors see SHAP values, not just scores. Trust is essential for adoption in government workflows.
- **Built for KSA context:** RTL/Arabic-first UI, integration with Balady and 940, seasonality aligned with Hajj/Ramadan/National Day.
- **Closed feedback loop:** Every inspection result retrains the model, so the system gets smarter with each shift.
- **Bias and fairness safeguards:** Separate performance metrics by district, license type, and establishment size; automatic alerts if a subgroup is over- or under-flagged.

---

## 5. Data & Modeling

### 5.1 Required Datasets

| Dataset | Source / How to Obtain | Predictive Value |
|---|---|---|
| Historical inspection records | Balady back-end, internal MOMRAH data | Direct labels for supervised learning |
| 940 complaint logs | Balady app / 940 call center | Leading indicator of emerging risk |
| Commercial license registry | Balady licenses API/database | License type, age, renewal status |
| Health certificates | Balady health-certificate service | Worker-certification compliance |
| Geospatial layers | OpenStreetMap / MOMRAH GIS | Neighborhood density, nearby violations |
| Seasonal / event calendar | Hajj, Ramadan, National Day, school calendars | Demand spikes and staffing pressure |
| Weather | Saudi open-data / meteorology API | Temperature, dust storms affect food safety |
| Inspector logs | Field reports from past campaigns | Ground-truth outcomes for feedback loop |

> For the hackathon demo, any dataset that cannot be released can be **synthesized** from published statistics (e.g., the 29,000 visits / 5,000 samples numbers) and realistic distributions, clearly labeled as synthetic.

### 5.2 Feature Engineering

**Static features**

- License category (restaurant, cafeteria, construction site, etc.)
- License age and time-to-renewal
- Establishment size / seating capacity (if available)
- Past violation count and severity

**Temporal features**

- Days since last inspection
- Days since last violation
- Complaint count in last 7 / 30 / 90 days
- Inspection frequency trend

**Geospatial features**

- Violation density within 500 m and 1 km radius
- Complaint density within same radius
- Distance to high-traffic locations (markets, Hajj routes)

**Seasonal/event features**

- Days to / from major event (Hajj, Ramadan, National Day)
- Current weather extremes
- Public holiday flags

### 5.3 Model Choice

- **Primary model:** Gradient Boosted Decision Trees (XGBoost / LightGBM / CatBoost). Handles tabular data, mixed feature types, missing values, and non-linear interactions well.
- **Spatiotemporal extension:** A Poisson or negative-binomial point-process model, or a graph neural network, to capture spatial spillover of violations.
- **Calibration layer:** Isotonic regression or Platt scaling so that the predicted probability is well-calibrated (a 0.85 score means roughly 85% of flagged sites should be violations).
- **Explainability:** SHAP (SHapley Additive exPlanations), introduced by Lundberg & Lee (2017), to decompose each prediction into feature contributions. [^8]

### 5.4 Handling Class Imbalance

Municipal violations are typically rare relative to compliant establishments. Techniques:

- **Sampling:** scale_pos_weight in XGBoost/LightGBM, or SMOTE on the training set.
- **Evaluation metric:** optimize **Precision@K** (also called hit-rate at top-K). In plain terms: "Of the top-N establishments we send inspectors to, what fraction actually have a violation?" This is the metric that directly translates to inspector productivity.
- **Secondary metrics:** AUC-ROC, AUC-PR, calibration error, fairness metrics by district/license type.

### 5.5 Evaluation Benchmarks

A directly relevant precedent is the **Chicago Food Inspections Evaluation** project, which built an open-source predictive model for critical violations at food establishments. The City of Chicago partnered with Allstate's quantitative research team and found that inspectors using the model located critical violations faster than under the standard schedule. [^9]

Another useful reference is the published methodology of the Chicago model, which uses publicly available data (business licenses, food inspections, crime, sanitation complaints, weather) joined to a business-license unit of observation — a pattern that maps cleanly to Balady's license-centric data. [^9]

For Raqeeb AI, a realistic demo target would be:

- **Baseline hit-rate:** assume 10–20% of routine inspections find a serious violation.
- **Raqeeb target:** **2×–3× hit-rate** in the top 10% of flagged establishments (i.e., 30–50% hit-rate at top-K).

These targets should be framed as hypotheses to be validated with real MOMRAH data, not guaranteed outcomes.

---

## 6. MVP Scope for a 2-Day Hackathon

### 6.1 Buildable Demo

1. **Synthetic dataset** (~1,000 establishments, 5 districts, 12 months of inspections/complaints) seeded with realistic violation rates.
2. **Trained risk model** (LightGBM/XGBoost) outputting a probability and SHAP explanations.
3. **Dashboard web app** with:
   - Risk heatmap by district
   - Prioritized inspection list (sortable, filterable)
   - "Why flagged" SHAP panel per establishment
   - Simulate-inspection button that updates the model's feedback loop
4. **Pitch deck** (10 slides) covering problem, solution, impact, architecture, and Vision 2030 alignment.

### 6.2 Architecture & Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + TypeScript + Tailwind CSS + Recharts/Leaflet | Fast, modern, RTL-capable, interactive maps |
| Backend API | FastAPI (Python) or Next.js API routes | Lightweight, easy to demo, good ML ecosystem |
| ML runtime | Python, scikit-learn, LightGBM, SHAP | Standard, well-documented, fast training |
| Database | SQLite / PostgreSQL for demo; production uses Balady DWH | Simple for hackathon, scalable later |
| Geospatial | GeoPandas + Leaflet/Mapbox GL | Heatmaps and route visualization |
| Deployment | Vercel / Render / local Docker | Free tiers, quick demos |

### 6.3 Data Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Balady + 940   │────▶│  Feature Store   │────▶│  Risk Model     │
│  (data sources) │     │  (SQLite/PostGIS)│     │  (LightGBM+SHAP)│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Inspectors     │◀────│  Raqeeb Dashboard│◀────│  Priority Route │
│  (mobile/web)   │     │  (React + Map)   │     │  + SHAP Panel   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                         ▲
        │   inspection outcome    │
        └─────────────────────────┘
```

---

## 7. Why Judges Will Pick It

### 7.1 Measurable Impact

- **Inspector productivity:** Precision@K means inspectors find violations faster, reducing the number of low-value visits.
- **Cost savings:** Fewer vehicle-kilometers, less overtime, and better allocation of the 380+ food-safety inspectors during Hajj. [^5]
- **Public-health protection:** Preventing violations before they harm citizens aligns with the zero food-poisoning outcome reported in Hajj 1447. [^4]
- **Faster response to 940 complaints:** Predictive routing can integrate complaint-driven cases instead of treating them as separate queues.

### 7.2 Saudi Vision 2030 Alignment

Vision 2030 emphasizes digital government, data-driven decision making, quality of life, and world-class service delivery during Hajj and Umrah. [^10] Raqeeb AI directly supports:

- **Digital transformation** of municipal services.
- **Operational efficiency** in government.
- **Public safety and quality of life** in Saudi cities.
- **Hajj and Umrah service excellence** through proactive risk management.

### 7.3 Feasibility

- Uses only data MOMRAH already collects (Balady licenses, 940 complaints, inspector logs).
- Builds on proven open-source precedent (Chicago Food Inspections Evaluation). [^9]
- MVP can be built in 48 hours with synthetic data and a working dashboard.
- No new hardware required for the pilot; it is a software layer on top of existing systems.

### 7.4 Ethics and Bias Safeguards

- **Fairness monitoring:** Compare Precision@K across license categories, districts, and establishment sizes. Flag disparities.
- **Human-in-the-loop:** Inspectors always see the SHAP explanation and can override the recommendation.
- **Transparency:** Business owners can eventually access a high-level version of their risk factors to improve compliance before an inspection.
- **Privacy:** Uses only business-level and aggregate data; no individual citizen profiling.
- **Audit trail:** Every prediction, override, and outcome is logged for accountability.

---

## 8. Idea-Card Draft (Ready to Paste)

**Idea Name (Arabic):** رقيب الذكاء الاصطناعي — Raqeeb AI

**Idea Name (English):** Raqeeb AI — Proactive Municipal Inspection Intelligence

**Target Challenge:** Challenge 2 — AI-driven proactive inspection / AI Pre-Inspector

**Chosen Emerging Technology:** Artificial Intelligence (AI) + Explainable AI (XAI)

**Description (≤150 words):**

Raqeeb AI transforms municipal inspection from reactive to predictive. By analyzing historical inspections, 940 complaints, license metadata, geospatial patterns, and seasonal events, our model ranks establishments by violation probability and generates a prioritized daily inspection route for every inspector. Each recommendation is paired with a SHAP-based "why flagged" explanation so inspectors trust and act on it. A real-time feedback loop retrains the model with every inspection outcome, continuously improving accuracy. The solution aligns with Saudi Vision 2030's digital-government and quality-of-life goals, reduces inspector mileage, raises violation hit-rates, and protects public health — especially during high-intensity periods like Hajj. Our 2-day MVP includes a working dashboard, risk heatmap, prioritized target list, and explainable-inspection panel built on open, reproducible ML.

---

## 9. Prototype

A clickable dashboard prototype is provided in the same folder: **`dashboard-prototype.html`**. It demonstrates:

- District-level risk heatmap.
- Prioritized inspection list.
- Per-establishment SHAP-style explanation panel.
- Simulation of an inspection outcome.

Open the file in any modern browser to interact with the demo. The data is synthetic and clearly labeled as such.

A pitch deck is also included: **`pitch-deck.html`**.

> **Submission-format note:** The official idea-card form accepts attachments only as **PDF / PNG / JPG** (≤ 5 files, ≤ 100 MB total). [^2] Before uploading, convert:
> - `report-challenge2.md` → PDF (e.g., via Markdown-to-PDF or print-to-PDF),
> - `dashboard-prototype.html` → screenshots/PNG or a short demo video (the `.html` itself can be hosted or shared separately),
> - `pitch-deck.html` → PDF or PNG slides.
> The source `.md` and `.html` files remain the editable master copies.

---

## 10. References

[^1]: Ministry of Municipalities and Housing (MOMRAH). "Baladiyathon 2026." Official hackathon page. https://momah.gov.sa/ar/hackathon (accessed 2026-07-07).

[^2]: Ministry of Municipalities and Housing (MOMRAH). "Baladiyathon 2026 Idea Card Form." https://momah.gov.sa/ar/form/hackathon-2026 (accessed 2026-07-07). English mirror: https://momah.gov.sa/en/form/hackathon-2026.

[^3]: Balady — Ministry of Municipalities and Housing. Official platform homepage. https://www.balady.gov.sa/ (accessed 2026-07-07). Platform statistics: 2.7M+ users, 1.3M+ commercial licenses, 600K+ construction licenses, 1K+ engineering offices.

[^4]: Balady News. "وزارة البلديات والإسكان: فحص أكثر من 5 آلاف عينة غذائية وتنفيذ أكثر من 29 ألف زيارة رقابية لخدمة ضيوف الرحمن." 28 May 2026. https://www.balady.gov.sa/ar/about-balady/news/%D9%88%D8%B2%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D8%A8%D9%84%D8%AF%D9%8A%D8%A7%D8%AA-%D9%88%D8%A7%D9%84%D8%A5%D8%B3%D9%83%D8%A7%D9%86-%D9%81%D8%AD%D8%B5-%D8%A3%D9%83%D8%AB%D8%B1-%D9%85%D9%86-5-%D8%A2%D9%84%D8%A7%D9%81-%D8%B9%D9%8A%D9%86%D8%A9-%D8%BA%D8%B0%D8%A7%D8%A6%D9%8A%D8%A9-%D9%88%D8%AA%D9%86%D9%81%D9%8A%D8%B0-%D8%A3%D9%83%D8%AB%D8%B1-%D9%85%D9%86-29-%D8%A3%D9%84%D9%81 (accessed 2026-07-07).

[^5]: Balady News. "وزارة البلديات والإسكان: فحص 1300 عينة يوميًا وتنفيذ أكثر من 2800 زيارة رقابية بمكة والمشاعر." 20 May 2026. https://www.balady.gov.sa/ar/about-balady/news/%D9%88%D8%B2%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D8%A8%D9%84%D8%AF%D9%8A%D8%A7%D8%AA-%D9%88%D8%A7%D9%84%D8%A5%D8%B3%D9%83%D8%A7%D9%86-%D9%81%D8%AD%D8%B5-1300-%D8%B9%D9%8A%D9%86%D8%A9-%D9%8A%D9%88%D9%85%D9%8A%D9%8B%D8%A7-%D9%88%D8%AA%D9%86%D9%81%D9%8A%D8%B0-%D8%A3%D9%83%D8%AB%D8%B1-%D9%85%D9%86-2800-%D8%B2%D9%8A%D8%A7%D8%B1%D8%A9-%D8%B1%D9%82%D8%A7%D8%A8%D9%8A%D8%A9 (accessed 2026-07-07).

[^6]: Balady News. "وزارة البلديات والإسكان تعلن نجاح خطتها التشغيلية لموسم حج 1447هـ." 30 May 2026. https://www.balady.gov.sa/ar/about-balady/news/%D9%88%D8%B2%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D8%A8%D9%84%D8%AF%D9%8A%D8%A7%D8%AA-%D9%88%D8%A7%D9%84%D8%A5%D8%B3%D9%83%D8%A7%D9%86-%D8%AA%D8%B9%D9%84%D9%86-%D9%86%D8%AC%D8%A7%D8%AD-%D8%AE%D8%B7%D8%AA%D9%87%D8%A7-%D8%A7%D9%84%D8%AA%D8%B4%D8%BA%D9%8A%D9%84%D9%8A%D8%A9-%D9%84%D9%85%D9%88%D8%B3%D9%85-%D8%AD%D8%AC-1447%D9%87%D9%80 (accessed 2026-07-07).

[^7]: Ministry of Municipalities and Housing (MOMRAH). Official homepage listing Balady (199040) and 940 contact numbers. https://momah.gov.sa/ar (accessed 2026-07-07).

[^8]: Lundberg, S. M., & Lee, S. I. (2017). "A Unified Approach to Interpreting Model Predictions." arXiv:1705.07874 [cs.AI]. https://arxiv.org/abs/1705.07874.

[^9]: City of Chicago. "Food Inspections Evaluation." GitHub repository. https://github.com/Chicago/food-inspections-evaluation. Description: open-source predictive model for critical violations at Chicago food establishments, used by Chicago Department of Public Health to prioritize inspections.

[^10]: Saudi Vision 2030. "Quality of Life Program" and "Hajj and Umrah Program" objectives. https://www.vision2030.gov.sa/ (referenced for strategic alignment; specific program pages can be cited in final submission if required).

---

## 11. Team Roles (Suggested)

| Role | Responsibility |
|---|---|
| ML Engineer | Feature engineering, model training, SHAP explanations, evaluation metrics |
| Full-Stack Developer | FastAPI backend, React dashboard, map integration, feedback loop |
| Domain / Product Lead | Municipal workflow design, pitch narrative, Vision 2030 alignment |
| Data / MLOps Engineer | Data pipeline, synthetic data generation, bias monitoring, deployment |

---

## 12. Risk Register

| Risk | Mitigation |
|---|---|
| Real MOMRAH data unavailable for demo | Build high-fidelity synthetic dataset from published statistics; label clearly |
| Model bias against small businesses | Fairness metrics by establishment size; human override; audit trail |
| Inspector adoption | Explainable SHAP panel; simple mobile-first UI; integrate into existing Balady workflows |
| Low data quality | Design feature set to tolerate missing values; use robust gradient boosting |
| Overfitting to historical patterns | Time-based train/test split; rolling evaluation; feedback loop |

---

*Prepared for Baladiyathon 2026 — Challenge 2. All factual claims are cited. Synthetic demo data is clearly labeled. Venue detail was not found on an official source and is therefore omitted.*

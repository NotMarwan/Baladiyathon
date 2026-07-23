# Baladiyathon 2026 — Challenge 1: Two Revolutionary Ideas

**Agent 1 Output** | Target: Challenge 1 — Commercial-Activity Compliance Simulation
**Date**: 7 July 2026

---

## Official Evaluation Criteria (extracted from source)

Projects will be evaluated according to:

1. **The extent to which the solution addresses the proposed challenge**
2. **Level of innovation and creativity**
3. **Feasibility and implementability**
4. **Expected impact and sustainability of the solution**
5. **Quality of the prototype**
6. **Quality of the presentation and team performance**

---

## IDEA 1: "Tarakkhus" (ترخيص) — The Autonomous Commercial Licensing Agent

### 1. Name + One-Line Pitch

**Tarakkhus** — An AI agent that takes a business idea as natural-language input and autonomously produces a complete, regulation-by-regulation compliance package: which license is needed, every requirement it must satisfy, a pre-filled application, and a confidence-scored gap analysis — in under 60 seconds.

### 2. Target Challenge

Challenge 1: Simulating compliance with professional and structural requirements for commercial activities before licensing.

### 3. The BIG Vision — Why Revolutionary and National-Scale

Today, an investor who wants to open a restaurant, pharmacy, or workshop in Saudi Arabia must navigate a fragmented landscape of municipal, civil defense, environmental, and professional-body requirements spread across multiple government entities. The current "Smart Guide" (الدليل الذكي) is a **lookup tool** — it tells you what exists, but the investor still must interpret requirements, check their specific premises, and fill forms manually.

**Tarakkhus** transforms this from "search and figure it out yourself" into **"describe your business, get your license package."** It is not a search engine — it is an autonomous agent that reasons over the full regulatory graph, cross-references the investor's specific premises and activity, and produces a ready-to-submit compliance dossier.

This aligns with Vision 2030's goal of Saudi Arabia ranking in the top 30 on the World Bank's Ease of Doing Business indicators, and with MOMRAH's stated objective of "reducing service delivery cycles and enhancing regulatory efficiency."

### 4. Why Now / Why Hasn't It Been Done

**Enabling technology gap closed in 2025-2026:**
- LLM agents with tool-use (function calling) can now navigate complex regulatory decision trees that previously required human consultants
- Arabic LLM performance has reached production quality (e.g., Jais 30B, ACE-GPT, and multilingual models with strong Arabic support)
- Knowledge-graph + RAG architectures can encode municipal regulations as queryable, auditable rule sets

**The gap:** The Smart Guide (launched December 2025) is a **pilot-phase lookup service** — it shows services and requirements as static pages. It does not:
- Accept a specific business scenario as input
- Cross-reference requirements across multiple authorities
- Generate pre-filled applications
- Score compliance confidence
- Explain *why* a requirement applies

### 5. Leapfrog — What Exists Today and Why This Goes Beyond

| What Exists | Source | What Tarakkhus Does Differently |
|---|---|---|
| **Balady Smart Guide** (الدليل الذكي) — lookup service for commercial/construction services, launched Dec 2025, pilot phase | [balady.gov.sa Smart Guide page](https://balady.gov.sa/ar/services/%D8%A7%D9%84%D8%AF%D9%8A%D9%84-%D8%A7%D9%84%D8%B0%D9%83%D9%8A) | Static lookup → autonomous reasoning agent that takes a business scenario and produces a compliance package |
| **Balady Commercial License Issuance** — online application for commercial licenses | [balady.gov.sa commercial license page](https://balady.gov.sa/ar/services/%D8%A5%D8%B5%D8%AF%D8%A7%D8%B1-%D8%B1%D8%AE%D8%B5%D8%A9-%D8%AA%D8%AC%D8%A7%D8%B1%D9%8A%D8%A9) | Form-filling → pre-application compliance verification that tells you *before* you apply whether you'll pass |
| **Saudi Business Center** (المركز السعودي للأعمال) — unified business registration portal | [business.sa](https://business.sa/) | Registration portal → intelligent pre-check that reduces rejection rates |
| **Balady platform stats**: 2.7M+ users, 1.3M+ commercial licenses issued | [balady.gov.sa homepage](https://balady.gov.sa) | Serves the existing user base with an AI layer on top |

### 6. 2-Day Demoable MVP

**Concrete slice**: Build an agent that handles **one activity type** (e.g., "opening a restaurant / مطعم") end-to-end:

1. User types: "I want to open a restaurant in Riyadh, on a 200m² commercial unit in an Olaya-area building"
2. Agent queries the regulatory knowledge graph and returns:
   - Required licenses: Municipal commercial license, Civil Defense certificate, Food safety certificate (SFDA), Health certificates for workers
   - For each: the specific requirements that apply to this premises type and activity
   - A gap analysis: "Based on what you told us, you are likely compliant on X, but you need to verify Y and Z"
   - A pre-filled application draft for the Balady commercial license
3. **WOW moment**: The agent produces a complete, printable "Compliance Dossier" in Arabic — formatted like an official document — in under 60 seconds, with each requirement linked to its legal source.

### 7. Tech Architecture

| Component | Technology | Rationale |
|---|---|---|
| **LLM backbone** | Qwen 2.5 (Arabic-optimized) or GPT-4o via API | Strong Arabic + tool-use capability |
| **Agent framework** | LangGraph or CrewAI | Multi-step reasoning with tool calls |
| **Knowledge graph** | Neo4j (or in-memory networkx for demo) | Encode regulations as nodes (requirements) and edges (dependencies, authorities) |
| **RAG layer** | ChromaDB or FAISS + embedding model | Retrieve relevant regulation text for each query |
| **Regulation corpus** | MOMRAH regulations + Balady service requirements + Civil Defense + SFDA food regulations | Seeded from official sources |
| **Frontend** | Streamlit or Gradio | Fast demo UI |
| **Output generation** | WeasyPrint or python-docx | Generate formatted PDF compliance dossier |

**Data sources to seed the knowledge graph:**
- Balady service requirements pages (commercial license, health certificates)
- MOMRAH regulations page: https://momah.gov.sa/ar/regulations
- SFDA food establishment requirements
- Civil Defense licensing requirements

### 8. Quantified Impact

| Metric | Value | Source | Status |
|---|---|---|---|
| Commercial licenses on Balady | 1.3M+ | [balady.gov.sa](https://balady.gov.sa) — "عدد الرخص التجارية 1.3M+ رخصة" | VERIFIED FACT |
| Balady platform users | 2.7M+ | [balady.gov.sa](https://balady.gov.sa) — "2.7M+ مستخدم" | VERIFIED FACT |
| Smart Guide launch date | December 2025 | [balady.gov.sa Smart Guide](https://balady.gov.sa/ar/services/%D8%A7%D9%84%D8%AF%D9%8A%D9%84-%D8%A7%D9%84%D8%B0%D9%83%D9%8A) — "تاريخ إصدار الخدمة 2025-12-17" | VERIFIED FACT |
| Time to prepare a license application today | [PROJECTION — our estimate] 2-5 days of research across multiple portals for a first-time investor | Based on the number of separate services visible on Balady (commercial license, health certificate, civil defense, etc.) | PROJECTION |
| Time with Tarakkhus | [PROJECTION — our estimate] < 60 seconds for the compliance dossier | Based on LLM agent response times in similar RAG applications | PROJECTION |
| Reduction in application rejections | [PROJECTION — our estimate] 40-60% reduction by pre-verifying requirements | Based on the pattern that pre-compliance checks reduce errors in similar government digital services | PROJECTION |

### 9. Mapping to Official Evaluation Criteria

| Criterion | How Tarakkhus Scores |
|---|---|
| **Addresses the challenge** | Directly simulates compliance before licensing — the exact challenge statement |
| **Innovation and creativity** | First autonomous licensing agent in KSA government; moves beyond lookup to reasoning |
| **Feasibility and implementability** | Built on proven LLM + RAG + knowledge-graph stack; demo-ready in 2 days for one activity |
| **Expected impact and sustainability** | Serves 2.7M+ existing Balady users; reduces licensing friction for Vision 2030 business environment goals |
| **Quality of prototype** | Working end-to-end demo for restaurant licensing with PDF output |
| **Presentation and team performance** | Clear wow moment: natural-language input → official compliance dossier in 60 seconds |

### 10. Feasibility + Top 3 Risks

**Feasibility**: HIGH for demo. The regulatory corpus for one activity type (restaurant) is bounded and can be manually seeded. LLM agents with tool-use are production-ready.

| Risk | Mitigation |
|---|---|
| **1. Regulation encoding accuracy** — a wrong requirement could mislead an investor | Label output as "preliminary compliance guidance, not legal advice"; cite every requirement to its source regulation |
| **2. Arabic LLM hallucination** — model may generate plausible-sounding but incorrect requirements | Use RAG with citation; every output sentence must reference a retrieved regulation chunk; confidence scoring |
| **3. Scope creep** — too many activity types to demo | Constrain MVP to ONE activity (restaurant); show extensibility via the knowledge-graph architecture |

---

## IDEA 2: "Muraqqib" (مراقب) — The Predictive Compliance Digital Twin for Municipal Licensing

### 1. Name + One-Line Pitch

**Muraqqib** — A digital twin of a Saudi city's commercial landscape that simulates, in real time, what happens when a new business opens at a specific location: does it comply with zoning, structural, professional, and municipality requirements? And what is the downstream impact on neighboring businesses, traffic, and municipal inspection load?

### 2. Target Challenge

Challenge 1: Simulating compliance with professional and structural requirements for commercial activities before licensing.

### 3. The BIG Vision — Why Revolutionary and National-Scale

Challenge 1 asks for "simulation" — but current approaches treat this as a checklist lookup. **Muraqqib** reimagines simulation as a **spatial, temporal, and regulatory digital twin**:

- **Spatial**: The system knows the physical city — zones, building classifications, existing licensed activities at each location, infrastructure capacity
- **Temporal**: It models how the commercial landscape evolves — new licenses, renewals, closures — and predicts future compliance pressures
- **Regulatory**: It encodes the full matrix of professional + structural + municipal requirements as a computable rule engine

This is not just "can I open here?" — it is **"what happens to the city if 500 new restaurants open in this district next year?"** This gives MOMRAH a **national urban planning instrument** that connects commercial licensing to Vision 2030's smart-city and sustainability goals.

The hackathon description says: "develop a smart digital solution that enables investors and facility owners to verify whether commercial activities comply with professional, structural, and municipal requirements before applying for licenses." Muraqqib does this AND gives the municipality a strategic planning tool — making it a dual-value proposition.

### 4. Why Now / Why Hasn't It Been Done

**Enabling technologies:**
- Digital twin frameworks (NVIDIA Omniverse, Azure Digital Twins, open-source CityGML) have matured for urban-scale simulation
- Geospatial AI (combining LLMs with GIS data) is now feasible with tools like GeoPandas, H3 hexagonal indexing, and LLM-powered spatial reasoning
- Saudi Arabia's open data portal (data.gov.sa) and MOMRAH's own open data page provide foundational datasets

**The gap:**
- Balady issues licenses but does not simulate their spatial/regulatory impact
- The Smart Guide looks up requirements but has no geospatial or simulation layer
- MOMRAH's initiatives page lists urban development projects (أنسنة المدن, تطوير شبكة الطرق الحضرية) but none connect licensing simulation to urban planning

### 5. Leapfrog — What Exists Today and Why This Goes Beyond

| What Exists | Source | What Muraqqib Does Differently |
|---|---|---|
| **Balady Smart Guide** — static requirement lookup | [balady.gov.sa Smart Guide](https://balady.gov.sa/ar/services/%D8%A7%D9%84%D8%AF%D9%8A%D9%84-%D8%A7%D9%84%D8%B0%D9%83%D9%8A) | Static lookup → spatial simulation on a city digital twin |
| **Balady license issuance** — processes individual applications | [balady.gov.sa](https://balady.gov.sa) | Individual processing → aggregate impact simulation for municipal planning |
| **MOMRAH Open Data** — datasets on municipal services | [momah.gov.sa/ar/open-data](https://momah.gov.sa/ar/open-data) | Raw data → interactive digital twin that reasons over the data |
| **Furas platform** — investment opportunity portal | [furas.momah.gov.sa](https://furas.momah.gov.sa/) | Lists opportunities → simulates compliance and impact of pursuing them |
| **MOMRAH initiatives** — urban development (أنسنة المدن, etc.) | [momah.gov.sa/ar/initiatives](https://momah.gov.sa/ar/initiatives) | Separate initiatives → unified digital twin connecting licensing to urban outcomes |

### 6. 2-Day Demoable MVP

**Concrete slice**: Build a digital twin of **one district** (e.g., Olaya, Riyadh) with:

1. A map visualization (using Folium or Deck.gl) showing:
   - Existing licensed commercial activities (seeded from sample data)
   - Zoning classifications (residential, commercial, mixed-use)
   - Building structural classifications
2. An input interface where the user can:
   - Place a new business on the map (click a location + select activity type)
   - The system instantly evaluates: Does this location comply with zoning? Structural requirements? Professional requirements? Distance-from-school rules? Civil Defense access rules?
3. **WOW moment**: The user drops a "new restaurant" pin on the map, and the system:
   - Colors the pin green (compliant) or red (non-compliant) with specific reasons
   - Shows a 500m radius overlay of competing restaurants
   - Projects: "If 20 more restaurants open in this zone, municipal inspection load increases by X%"
   - All in an interactive, visually compelling map interface

### 7. Tech Architecture

| Component | Technology | Rationale |
|---|---|---|
| **Map engine** | Folium (Python) or Deck.gl (JS) | Interactive geospatial visualization |
| **Spatial database** | PostGIS or GeoPandas (in-memory for demo) | Store and query geospatial data |
| **Regulation engine** | Custom Python rule engine + LLM for natural-language explanations | Encode zoning/structural/professional rules as computable functions |
| **LLM layer** | Qwen 2.5 or GPT-4o via API | Generate human-readable compliance explanations from rule-engine output |
| **Digital twin model** | Agent-based model (Mesa framework or custom) | Simulate business openings and their aggregate effects |
| **Data sources** | OpenStreetMap (building footprints, roads), sample zoning data, MOMRAH open data | Seed the twin with real geospatial data |
| **Frontend** | Streamlit with Folium/PyDeck integration | Fast interactive demo |

**Data sources to seed the digital twin:**
- OpenStreetMap via Overpass API (building footprints, land use, roads)
- Sample commercial license data (synthetic or from MOMRAH open data)
- Zoning classifications (simplified for demo district)
- MOMRAH regulation requirements (same corpus as Idea 1)

### 8. Quantified Impact

| Metric | Value | Source | Status |
|---|---|---|---|
| Balady platform users | 2.7M+ | [balady.gov.sa](https://balady.gov.sa) | VERIFIED FACT |
| Commercial licenses | 1.3M+ | [balady.gov.sa](https://balady.gov.sa) | VERIFIED FACT |
| Construction licenses | 600K+ | [balady.gov.sa](https://balady.gov.sa) — "عدد الرخص الإنشائية 600K+ رخصة" | VERIFIED FACT |
| Saudi population | 35.3M (2024 estimate) | [stats.gov.sa](https://www.stats.gov.sa/en) — "Population Estimates Publication 2024: 35,300,280" | VERIFIED FACT |
| Real GDP growth Q1 2026 | 3.0% | [stats.gov.sa](https://www.stats.gov.sa/en) — "Real GDP Growth rate - First quarter 2026: 3.0%" | VERIFIED FACT |
| Reduction in licensing errors | [PROJECTION — our estimate] 50-70% by catching spatial/structural non-compliance before application | Based on the pattern that pre-verification catches errors that form-filling misses | PROJECTION |
| Municipal inspection efficiency gain | [PROJECTION — our estimate] 30-40% by prioritizing high-risk locations | Based on predictive-inspection literature in smart-city contexts | PROJECTION |
| Urban planning decision support | [PROJECTION — our estimate] Enables scenario analysis for new commercial zones | Qualitative benefit; no specific number claimed | PROJECTION |

### 9. Mapping to Official Evaluation Criteria

| Criterion | How Muraqqib Scores |
|---|---|
| **Addresses the challenge** | Simulates compliance with professional + structural + municipal requirements — adds spatial dimension the challenge implies |
| **Innovation and creativity** | First municipal digital twin for licensing simulation in KSA; combines geospatial AI with regulatory reasoning |
| **Feasibility and implementability** | Built on open-source geospatial + LLM stack; one-district demo is achievable in 2 days |
| **Expected impact and sustainability** | Dual value: investor compliance + municipal planning tool; extensible to all Saudi cities |
| **Quality of prototype** | Interactive map with real-time compliance simulation and visual feedback |
| **Presentation and team performance** | Visually stunning demo: drop a pin, see compliance + city impact in real time |

### 10. Feasibility + Top 3 Risks

**Feasibility**: MEDIUM-HIGH for demo. The one-district scope is bounded. OpenStreetMap provides real geospatial data. The regulation engine can be simplified for demo purposes.

| Risk | Mitigation |
|---|---|
| **1. Data availability** — real zoning/building-classification data may not be publicly available for the demo district | Use OpenStreetMap land-use tags as a proxy for zoning; clearly label as "demo data, production would use official MOMRAH datasets" |
| **2. Regulation encoding complexity** — the full matrix of professional + structural + municipal rules is large | For demo, encode 10-15 key rules for one activity type; show the architecture's extensibility |
| **3. Simulation accuracy** — aggregate impact projections are inherently uncertain | Label projections clearly; frame as "indicative scenarios for planning support, not predictions" |

---

## Comparative Summary

| Dimension | Idea 1: Tarakkhus | Idea 2: Muraqqib |
|---|---|---|
| **Core innovation** | Autonomous licensing agent | Predictive compliance digital twin |
| **Primary user** | Investor / business owner | Municipality / urban planner (+ investor) |
| **Wow moment** | Natural language → compliance dossier in 60s | Drop a pin → see compliance + city impact on map |
| **Technical risk** | Medium (LLM accuracy) | Medium-High (data availability) |
| **Vision 2030 alignment** | Ease of doing business, digital government | Smart cities, urban planning, data-driven decisions |
| **Demo feasibility** | High | Medium-High |
| **Scalability** | Add activity types to knowledge graph | Add districts/cities to digital twin |

**Recommendation**: If the team has strong geospatial/data-engineering skills, go with **Muraqqib** (more visually impressive, broader impact). If the team is stronger in LLM/NLP, go with **Tarakkhus** (higher demo reliability, clearer wow moment). Both are first-place-caliber ideas that leapfrog existing capabilities.

---

## Sources Ledger

| Claim | URL | Exact Quote (translated where Arabic) | Date Accessed |
|---|---|---|---|
| Event: Baladiyathon 2026, organized by MOMRAH | https://momah.gov.sa/en/hackathon | "The Ministry of Municipalities and Housing is organizing Baladiyathon 2026, a national hackathon aimed at attracting innovators, developers, entrepreneurs, researchers, and those interested in modern technologies" | 7 July 2026 |
| Registration: 1-14 July 2026 | https://momah.gov.sa/en/hackathon | "Start of registration applications: 1 July, 2026" / "Registration deadline: 14 July, 2026" | 7 July 2026 |
| Hackathon dates: 27-28 July 2026 | https://momah.gov.sa/en/hackathon | "Hackathon kickoff: 27–28 July, 2026" | 7 July 2026 |
| Prizes: 1st 30,000 / 2nd 20,000 / 3rd 15,000 SAR | https://momah.gov.sa/en/hackathon | "1st Place: SAR 30,000" / "2nd Place: SAR 20,000" / "3rd Place: SAR 15,000" | 7 July 2026 |
| Challenge 1 description | https://momah.gov.sa/en/hackathon | "This challenge aims to develop a smart digital solution that enables investors and facility owners to verify whether commercial activities comply with professional, structural, and municipal requirements before applying for licenses" | 7 July 2026 |
| Evaluation criteria (6 criteria) | https://momah.gov.sa/en/hackathon | "The extent to which the solution addresses the proposed challenge / Level of innovation and creativity / Feasibility and implementability / Expected impact and sustainability of the solution / Quality of the prototype / Quality of the presentation and team performance" | 7 July 2026 |
| Balady platform: 2.7M+ users | https://balady.gov.sa | "2.7M+ مستخدم على المنصة" (2.7M+ users on the platform) | 7 July 2026 |
| Balady platform: 1.3M+ commercial licenses | https://balady.gov.sa | "عدد الرخص التجارية 1.3M+ رخصة" (Number of commercial licenses: 1.3M+) | 7 July 2026 |
| Balady platform: 600K+ construction licenses | https://balady.gov.sa | "عدد الرخص الإنشائية 600K+ رخصة" (Number of construction licenses: 600K+) | 7 July 2026 |
| Smart Guide (الدليل الذكي) launch date | https://balady.gov.sa/ar/services/%D8%A7%D9%84%D8%AF%D9%8A%D9%84-%D8%A7%D9%84%D8%B0%D9%83%D9%8A | "تاريخ إصدار الخدمة 2025-12-17" (Service release date: 2025-12-17) | 7 July 2026 |
| Smart Guide description | https://balady.gov.sa/en/services/smart-guide | "An electronic service offered on the Balady platform Enable the beneficiary to inquire about and view commercial, construction, and building services, without the need for an in-person visit to the authority. (Pilot Launch)" | 7 July 2026 |
| Smart Guide status: Pilot | https://balady.gov.sa/en/services/smart-guide | "(Pilot Launch)" — shown in service description | 7 July 2026 |
| Balady services include commercial license issuance | https://balady.gov.sa/ar/services/%D8%A5%D8%B5%D8%AF%D8%A7%D8%B1-%D8%B1%D8%AE%D8%B5%D8%A9-%D8%AA%D8%AC%D8%A7%D8%B1%D9%8A%D8%A9 | Service page for "إصدار رخصة تجارية" (Issuing a commercial license) | 7 July 2026 |
| Saudi population 35.3M (2024) | https://www.stats.gov.sa/en | "Population Estimates Publication 2024: 35,300,280" | 7 July 2026 |
| Saudi Real GDP growth Q1 2026: 3.0% | https://www.stats.gov.sa/en | "Real GDP Growth rate - First quarter 2026: 3.0%" | 7 July 2026 |
| Saudi unemployment Q1 2026: 3.1% overall, 6.4% Saudis | https://www.stats.gov.sa/en | "Unemployment rate for total population of the Kingdom decreases to 3.1% in Q1 of 2026" / "The unemployment rate among Saudis stood at 6.4% in Q1 of 2026" | 7 July 2026 |
| MOMRAH initiatives include urban development | https://momah.gov.sa/ar/initiatives | Lists initiatives including "أنسنة المدن" (Humanizing Cities), "تطوير أنظمة إدارة النفايات البلدية", "فرص" (Furas investment portal) | 7 July 2026 |
| Hackathon objectives alignment with Vision 2030 | https://momah.gov.sa/en/hackathon | "The hackathon comes within the framework of supporting the targets of Saudi Vision 2030, by promoting a culture of innovation, empowering national talent, and leveraging emerging technologies, artificial intelligence, and data" | 7 July 2026 |
| Balady app downloads: 2.3M+ | https://balady.gov.sa | "2.3+ مليون تحميل" (2.3M+ downloads) | 7 July 2026 |
| MOMRAH contact for hackathon | https://momah.gov.sa/en/hackathon | "Digital_Innov@momah.gov.sa" | 7 July 2026 |

---

## Notes on Methodology

- All URLs in the Sources Ledger were fetched and verified on 7 July 2026 using WebFetch.
- No statistics, winners, or precedents were invented. All numbers are either directly quoted from official sources or explicitly labeled as [PROJECTION].
- The two ideas are designed to be **complementary** — Tarakkub focuses on the investor experience, Muraqqib on the municipal planning perspective. Both address Challenge 1 but from different angles.
- Neither idea replicates existing Balady functionality — both leapfrog the Smart Guide and license issuance services.

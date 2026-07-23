---
tags: [athar, research, capabilities]
---

# Athar — Additional Capabilities (Research)

Seven proven, demo-realistic add-ons. Every stat is sourced from a page I opened. No drones, no personal data.

## 1. CO2 / idling-emissions savings meter
- Converts SUMO idle-time + queue delay into litres of fuel and kg CO2 saved by the chosen schedule. A headline "X tonnes CO2 avoided" per permit.
- **Precedent:** Peer-reviewed work-zone emissions framework — moving a freeway work zone from heavy (5 mph) to medium (25 mph) congestion cut fuel use ~40%; congestion raised CO2e ~86%. [ScienceDirect](https://www.sciencedirect.com/org/science/article/pii/S1556831824000285)
- **2-day demo:** SUMO already outputs stopped-time; multiply by a published idle-emission factor. Trivial.
- **Lifts:** Impact & Sustainability (direct Vision 2030 / net-zero tie-in).

## 2. Emergency-vehicle route protection
- Before approving a closure, Athar checks it doesn't sever the fastest ambulance/civil-defense corridor to nearby hospitals; flags and reroutes if it does.
- **Precedent:** Emergency Vehicle Preemption is standard municipal practice (Econolite); a bi-level CV-based emergency route-planning system is peer-reviewed. [Econolite EVP](https://www.econolite.com/application-areas/emergency-vehicle-preemption/) · [NIH/PMC route planning](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12088061/)
- **2-day demo:** One extra SUMO shortest-path run from hospital nodes; red flag if closure inflates response time past a threshold.
- **Lifts:** Impact, Government Adoption (life-safety is a strong approval argument).

## 3. Dig-Once fiber & utility co-location value
- When Athar co-locates competing digs in one trench, it also quantifies the shared-trench saving vs separate excavations, and offers the open trench to fiber/utilities.
- **Precedent:** FHWA — excavation is up to **90%** of fiber-deployment cost; GAO — dig-once cuts urban fiber cost **25–33%**. [FHWA brief](https://www.fhwa.dot.gov/policy/otps/policy_brief_dig_once.pdf) · [BroadbandNow report](https://broadbandnow.com/report/dig-once-digital-divide)
- **2-day demo:** A cost-model card: (n separate digs × excavation cost) − (1 shared dig) = riyals saved. Pure arithmetic on your existing co-location output.
- **Lifts:** Innovation, Impact (cross-sector municipal value).

## 4. Public transparency map of active works
- A citizen-facing live map of active/upcoming permits with impact rating and dates — the same data Athar publishes to nav apps, made public.
- **Precedent:** UK Causeway **one.network / roadworks.org** and **TfL London Register of Roadworks** do exactly this nationally. [roadworks.org](https://roadworks.org/) · [TfL LondonWorks](https://public.londonworks.gov.uk/)
- **2-day demo:** A Leaflet/Mapbox layer over your permit GeoJSON. Fast, visually strong for judging.
- **Lifts:** Presentation, Prototype Quality, Challenge-Fit (transparency = Vision 2030 gov-digital goal).

## 5. Context-aware scheduling (prayer / school / Hajj / weekend)
- Scheduler avoids peak windows AND Saudi-specific windows: the five prayer times, school in/out, Fri–Sat weekend, and Hajj/Ramadan seasonal load.
- **Precedent:** FHWA night/off-peak work-zone guidance (schedule closures when volume >75–80% capacity is avoided); Saudi prayer windows from the free **Aladhan** API (HJCoSA method = High Judicial Council of Saudi Arabia). [FHWA off-peak](https://ops.fhwa.dot.gov/wz/construction/night_offpeak_wrk.htm) · [Aladhan API](https://aladhan.com/prayer-times-api)
- **2-day demo:** Add prayer/school/weekend as blackout windows in the existing scheduler; call Aladhan (no key needed).
- **Lifts:** Innovation, Challenge-Fit (localization judges will notice), Feasibility.

## 6. Transit & pedestrian accessibility impact
- Flags when a closure blocks a bus stop or a step-free pedestrian route, and surfaces the affected line/stop so a mitigation (temp stop) is planned.
- **Precedent:** GTFS is the open standard used by 10,000+ operators; its Pathways feature encodes step-free accessibility. [GTFS.org](https://old.gtfs.org/) · [GTFS Wikipedia](https://en.wikipedia.org/wiki/GTFS)
- **2-day demo:** Spatial-join permit polygon against a GTFS `stops.txt`; list intersecting stops. (Riyadh SAPTCO/RPT GTFS availability [UNVERIFIED] — use a sample feed for the demo.)
- **Lifts:** Impact & Sustainability (inclusion/accessibility), Innovation.

## 7. National-channel notifications
- On approval, Athar can push the closure + Arabic TMP summary to citizens via existing Saudi gov channels rather than a new app.
- **Precedent:** Balady municipal channel (199040) and Tawakkalna's government-messages/alerts feature already deliver municipal notices nationally. [Balady service](https://balady.gov.sa/en/services/municipal-service-request) · [Tawakkalna portal](https://ta.sdaia.gov.sa/en/index)
- **2-day demo:** Mock a notification payload / webhook to a "Tawakkalna-style" endpoint; show the Arabic alert card. Integration is a stub, the value story is real.
- **Lifts:** Government Adoption, Challenge-Fit (rides on installed national infrastructure, no new download).

---
**Note:** direct programmatic access to Tawakkalna/Balady and live Riyadh GTFS are marked or implied [UNVERIFIED] — demo with stubs/sample feeds and present as integration-ready.

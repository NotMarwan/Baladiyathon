# PROMPT FOR KIMI 3 — World-Class Map Redesign

انسخ كل ما تحت الخط إلى Kimi 3 كما هو. أرفق معه الملفات الأربعة المذكورة في قسم CONTEXT FILES.

---

## ROLE

You are a senior cartographic designer and creative front-end engineer. You have shipped award-winning interactive maps (think Red Dot / Awwwards caliber). You are being given full creative authority over ONE thing: the map. Nothing else. Treat the map as the hero of the product — the single most memorable visual a hackathon judge will see.

## MISSION

Redesign the interactive map of "Athar" (أثر) — a pre-permit traffic-impact decision tool for road excavation permits (Riyadh, Baladiyathon 2026 hackathon) — from its current state (flat colored GeoJSON lines on a beige background, default Leaflet look) into a map that looks like it belongs in a national mobility control room. The current map is functional but visually cheap. Your job: make it breathtaking without breaking anything functional.

You have COMPLETE creative freedom on visual direction. Do not ask for permission. Explore, decide, commit. Generate the full working code.

## HARD CONSTRAINTS (the only limits — everything else is yours)

1. **Stack**: Leaflet 1.x (already vendored locally at `vendor/leaflet.js`). You may extend it with custom panes, canvas renderers, CSS filters, SVG defs (glow/gradients), custom controls, and hand-written JS. You may NOT add external services, tile servers, CDN scripts, or network requests of any kind.
2. **Offline-first**: the page is opened as a local file the day of judging. Zero internet. All fonts, icons, effects must be local or system.
3. **Data**: the road network is a local GeoJSON (`data/riyadh-roads.geojson.js`, exposed as `window.RIYADH_ROADS`, ~1035 LineString features, properties: `osmId, highway (motorway|trunk|primary|secondary|tertiary), name, lanes, aadt`). The module `athar-ownedmap.js` currently renders it. Keep the data contract intact.
4. **Functional contract — must keep working**:
   - Clicking "حدد موقع الحفر" places the dig site on the corridor polyline.
   - The corridor (طريق الملك فهد segment) must stay visually dominant.
   - Alternative routes get drawn on the network after site selection (Dijkstra output — polylines added at runtime).
   - Red-to-green state change when an optimized schedule is chosen (this is the demo's money shot — amplify it, don't remove it).
   - The 24-hour timeline slider recolors congestion states over the day.
5. **RTL Arabic UI**: all labels, tooltips, legends in Arabic. Numerals may be Arabic-Indic. Attribution line must remain: `بيانات الطرق © مساهمو OpenStreetMap (ODbL)`.
6. **Performance**: 1035 features must pan/zoom smoothly on a mid-range laptop. Prefer Canvas renderer (`L.canvas()`) if SVG chokes. No jank during the timeline animation.
7. **Honesty**: demo data is labeled "بيانات توضيحية للعرض" — keep that label visible near the map.

## DESIGN DIRECTION — study these references, then form YOUR OWN opinion

Do not copy any single one. Synthesize. These are the quality bar:

- **kepler.gl demo (kepler.gl/demo)** — dark basemap discipline: near-black canvas, data as light. Roads glow against darkness. This is the gold standard for "data is the hero" mapping.
- **CARTO Dark Matter / Positron basemaps** — how to make a road network readable with only 3-4 neutral tones + one accent.
- **Mapbox Standard style & Mapbox Studio showcase (mapbox.com/mapbox-studio)** — hierarchy through line-width ramps and color temperature, not rainbow palettes. Motorways warm and wide, tertiary cool and hairline.
- **Pixonal "Fusion" for Abu Dhabi Mobility (Red Dot 2025, on mapbox.com/blog BUILD 2025 roundup)** — a government mobility control-room aesthetic: calm, premium, authoritative. This is EXACTLY the emotional register Athar needs — a tool a ministry would buy.
- **one.network (uk.one.network live roadworks map)** — the domain benchmark: how real roadworks platforms mark closures, diversions, works pins. Steal its semantics (closure = distinctive dashed/hatched treatment, diversion = animated directional dashes), not its visuals (it looks corporate-dated).
- **Uber deck.gl TripsLayer animations** — animated dashes flowing along polylines to show direction/movement. Leaflet can fake this beautifully with `dashOffset` animation via requestAnimationFrame.
- **Awwwards interactive-map showcases** — micro-interactions: hover states that lift a road (widen + brighten + tooltip), smooth flyTo easings, entrance animation where the network draws itself in.

## WHAT "BEST POSSIBLE" LOOKS LIKE (aim here, exceed it if you can)

1. **A designed basemap, not an absence of one**: subtle district polygons or a faint grid/texture under the roads so the void reads as "night city", not "missing tiles". Consider a barely-visible landmass tint + water if derivable, or a pure gradient vignette.
2. **Typographic road labels**: pull `name` (Arabic) for the top-class roads only, render along-path or as elegant anchored labels at high zoom. Sparse. Never cluttered.
3. **Line hierarchy with light**: 5 highway classes → width ramp (e.g. 6/4.5/3/1.8/1px at z13) + luminance ramp. Add a soft glow (duplicate pane blurred, or CSS drop-shadow on the canvas pane) to motorways only.
4. **The corridor as protagonist**: pulsing dig-site marker (CSS keyframes), corridor stroked with a distinct treatment (e.g. double-casing: dark outer + bright inner), animated hatching while "closed".
5. **The red→green moment**: when the user picks the optimized schedule, do NOT just swap colors. Choreograph it: a wave of color travels along the corridor (animated gradient / dashOffset sweep, ~1.2s, eased), congestion halos fade, a subtle celebratory pulse. Judges must feel the traffic unlock.
6. **Timeline as atmosphere**: as the 24h slider plays, shift the scene — congestion glows breathe on arterials during peaks (08:00, 17:00), calm at night. Even a global CSS hue/brightness shift on the road pane sells "the city over a day".
7. **Custom controls**: restyle zoom buttons, add an elegant Arabic legend (collapsible), scale bar, and a north/compass touch. Everything matches one design system (the app uses: asphalt `#102535`, paper `#eef1ef`, blue `#1f6b8f`, amber `#d19231`; you may build a dark map theme around asphalt — or propose a better palette and use it consistently).
8. **Entrance**: on load, roads draw in by class (motorways first, 600ms stagger) — dash-array reveal trick. One-time, subtle, skippable.

## DELIVERABLES

1. `athar-ownedmap.js` — rewritten, same exported API: `{ styleFor, toRoutingSegments, load(map, geojson, L, onRoadClick), CLASS_AADT, CLASS_LANES }`. `toRoutingSegments` output shape must not change (routing depends on it).
2. A `<style>` block (or `athar-map.css`) with all map-specific CSS (panes, glows, animations, controls, RTL tooltips).
3. Any initialization snippet the host page must call, documented in comments.
4. A short design rationale (10 lines max): the direction you chose and why.

## CONTEXT FILES (attached)

- `presentation/athar-ownedmap.js` — current module (rewrite this)
- `presentation/athar-prototype.html` — host page (map div `#map`, init around line 687; see how `AtharOwnedMap.load` is called)
- `presentation/data/riyadh-roads.geojson.js` — the network data
- `presentation/athar-merged.html` — design tokens of the product family

## QUALITY BAR / SELF-CHECK BEFORE YOU ANSWER

- Would this map screenshot look at home on Awwwards or in a Mapbox showcase reel? If not, iterate before answering.
- Is every animation compositor-friendly (transform/opacity/filter/dashOffset) — no layout thrash at 60fps?
- Does it still work with zero network, zero new dependencies?
- Is the Arabic RTL experience first-class, not an afterthought?
- Did you keep the functional contract (dig site, alternatives, red→green, timeline) fully alive?

Take your time. Produce the complete, final, working code — not a sketch.

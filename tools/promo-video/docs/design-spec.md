# مسار — Promo Video Design Spec

Companion to `design-tokens.json` in this same folder. Source of truth for every
color/type/timing value is `Baladiyathon/presentation/masar-tokens.css` (quoted
below as `--masar-*`). Nothing here overrides the product's own tokens — it
extends them for a 1920×1080 cinematic canvas.

## Visual direction

**Municipal-grade editorial**: the film lives primarily in Masar's own light
product surfaces (`--masar-canvas` #ECEFF2, `--masar-surface` #FFFFFF,
`--masar-primary` #1D4E77) so judges never doubt this is the exact interface
they can click into right after the video ends. At the three narrative hinge
points — the open, the S3 turn, and the close — the frame drops into the
product's own *sanctioned* dark ink, `--masar-ink` #15202B, which Masar itself
already uses for its one deliberately-dark UI element (the savings banner over
the map; the token file even ships a matching `--masar-success-on-ink` #7FD6A6
specifically so content survives on that dark ground). That is the entire
"cinema" move: take a color the product already committed to and give it room
to breathe at full-bleed scale, instead of inventing a new dark palette. We
explicitly do **not** borrow the separate teal/lime/amber palette used by the
one-off pitch-deck and dossier HTML (`--asphalt`/`--teal`/`--lime` in
`masar-baladiyathon-judging-deck.html` / `masar-merged.html`) — those are
presentation skins, not the product's brand, and mixing them in would make the
video feel like a different product than the one judges are about to open.
Result: an evidence-obsessed, quietly confident civil-engineering product
elevated to cinema — not a generic gradient-blob startup sizzle reel.

## Scene compositions

All scenes: RTL. Text blocks anchor **right** inside the safe area
(`spacing.safeX` = 140px from the right edge on a 1920px canvas), never
centered body copy, except the two brand-lockup beats (S3, S6) noted below
where centering is the correct convention for a symmetrical logomark.

**S1 — Hook (0–8s, human pain)**
- Background: full-bleed `--masar-ink` #15202B. If real/generated night
  roadwork B-roll is available, run it under a 75% `--masar-ink` scrim instead
  of a flat card — grounds the pain beat in a real street rather than an
  abstract color panel. Flat ink card is the fallback.
- Grid: single right-anchored column, max-width ≈60% of frame (never a full
  stretched banner).
- Animates: ink ground fades up (0–12f) → headline (`type.hero`, RTL
  word-stagger, right-to-left reveal order) → supporting caption line ~20f
  later → hold → begin fade-through-dark into S2 in the last
  `durations.sceneTransitionFrames` (18f).

**S2 — Cost (8–18s, animated numbers)**
- Background: crossfades from `--masar-ink` up to `--masar-canvas` within the
  first 2 frames of the scene — this is the film's first "light reveal."
- Grid: 2–3 stat blocks in a row, RTL reading order (the most important stat
  sits in the **rightmost** column), mirroring the product's own `.grid`/
  `.grid.three` card convention.
- Each block: number (`type.counterHero`, tabular, `--masar-ink` or
  `--masar-primary`) + one-line label (`type.body`) + an evidence chip docked
  lower-right of the number.
- Animates: first counter counts up (`durations.counterFrames`, 45f) with its
  chip popping in the instant it lands → next counter starts slightly before
  the first fully settles (light overlap, not strict sequence, to fit 2–3
  stats in ~10s) → closing connective sentence in the final ~1.5s.

**S3 — Turn + logo (18–25s, ~7s)**
- Background: hard fade back to full-bleed `--masar-ink`, optional soft
  radial glow in `--masar-primary` behind the mark (no rainbow — one accent
  glow only).
- Grid: **centered** — the one deliberate exception to right-anchoring; a
  symmetrical logo lockup reads correctly centered.
- Logo (`masar-logo-white.png`) mask-wipes on, wordmark settles beneath ~6–9f
  later via the `heavy` spring, then one turn-line (`type.h2`) fades in below
  in the final ~2s. See **Logo treatment** for the exact reveal mechanics and
  beat-sync note.

**S4 — Product proof (25–55s, 30s, the longest scene)**
- Background: stays `--masar-canvas` the whole 30s — this is the "editorial:
  light product surfaces" core of the film.
- Screenshots: device-less rounded panel, **not full-bleed** (full-bleed reads
  as a screen recording, not a directed film). Panel inset to ~78–85% of
  frame, corner radius scaled up from `--masar-radius-lg` (14px in-product) to
  ~28–32px at this scale, drop shadow scaled up from `--masar-shadow-lg`
  (`0 12px 32px rgb(21 32 43 / .14)`) to roughly
  `0 48px 140px rgba(21,32,43,.32)` — same shadow language, cinema scale.
- Text: one short claim line (`type.h2`/`type.body`) right-anchored beside or
  above each panel, one claim per ~6–7s beat (4–5 beats total).
- Animates per beat: panel enters (`smooth` spring) → Ken Burns pan-zoom runs
  for the full beat duration → claim text updates (word-stagger) as the zoom
  settles on the referenced UI region → cross-dissolve to next panel through
  light (canvas/surface), **not** through ink — the full dark dip is reserved
  for the 5 scene-level transitions only, so S4 doesn't repeatedly punch to
  black.

**S5 — Trust (55–65s, ~10s)**
- Background: `--masar-surface` #FFFFFF (quieter than canvas), staying light —
  gives a light/dark/light/light/light/dark rhythm across the film (visual
  quiet matches the music thinning out here) rather than an awkward split.
- Grid: right-anchored trust statement at `type.h2` (deliberately smaller than
  S1/S3's hero scale — this is a quiet beat) plus a row of all 4 evidence
  chips shown together (`chipProven`/`chipVerified`/`chipExpected`/
  `chipScenario`) — a callback to the individual chips seen in S2/S4, now
  lined up as "here is our full evidence ladder, stated plainly."
- Optional: one small, non-dominant supporting screenshot (e.g. the audit
  trail / shadow-pilot view) docked to one side, intentionally smaller than
  any S4 panel.

**S6 — Close (65–75s, ~10s)**
- Background: full-bleed `--masar-ink` — bookends S1/S3.
- Grid: **centered** (same exception as S3). Logo (`masar-logo-white.png`)
  settles via `smooth` spring (calmer than S3 — no wipe; repeating the wipe
  here would feel redundant), closing tagline (`type.h2`, centered) beneath,
  then a caption-size CTA line (project name / Baladiyathon 2026) appearing
  last and holding through the freeze frame.
- Final ~1–1.5s: no new motion, everything holds as music resolves, then cut
  to black.

## Motion language

- **Text entrance** (headlines, claim lines, turn-line): `smooth` spring
  (damping 20 / stiffness 120 / mass 1) driving opacity + a small upward
  translate (~24px) + slight blur-out-to-in.
- **Panel / screenshot slides** (S4 enter, S5 panel): `smooth` spring for the
  main move; `gentle` spring (damping 30 / stiffness 60 / mass 1) for any
  secondary parallax/drift layer behind it.
- **Counters landing / chip pop-in**: `snappy` spring (damping 15 / stiffness
  200 / mass 0.7) — fast, UI-like, matches the product's own quick
  `--masar-t-hover` (100ms) / `--masar-t-control` (160ms) responsiveness.
- **Logo reveal / full-scene punctuation moves**: `heavy` spring (damping 26 /
  stiffness 80 / mass 1.4) — deliberate, weighty settle, no cartoon bounce.
- **Scene-to-scene transitions**: ONE family for the whole film —
  **fade-through-dark**, crossfading through `--masar-ink` using the product's
  own deterministic easing curve `--masar-ease`
  (`cubic-bezier(0.16, 1, 0.3, 1)`) over `durations.sceneTransitionFrames`
  (18f), not a spring — transitions need a fixed, audio-syncable duration,
  which is why they use the CSS curve rather than physics. Within-scene
  screenshot swaps in S4 use the same curve but dissolve through light
  (`--masar-surface`) instead of ink, since only the 5 scene boundaries earn
  the full dark dip.
- **Ken Burns rule** (S4 screenshots): max zoom **1.15**, start 1.0 → end
  1.15, ease with `--masar-ease`, duration = the full dwell time of that beat
  (no separate short "zoom burst" — one continuous move per screenshot).
  Direction of pan always moves *toward* the specific UI region the claim
  text references (e.g. toward the evidence chip or decision panel being
  named), never a generic drift.
- **Kinetic typography for Arabic**: word-by-word stagger only, **never**
  letter-by-letter (Arabic ligatures/joining forms break mid-word if animated
  per-glyph). Stagger proceeds in logical reading order — first word to last
  word — which in RTL already displays right-to-left, so the visual reveal
  runs right→left naturally; do not reverse it. Stagger delay =
  `durations.wordStaggerFrames` (3f ≈ 100ms at 30fps) between word starts.
- **Number counters**: Latin numerals (0–9), never Eastern Arabic-Indic
  digits — this matches the product's own convention of keeping numerals as
  an LTR island inside RTL text (see `.context .num` /
  `.hero-number` / `.time b` in the dossier and judging-deck CSS, all
  `direction:ltr; text-align:right`). Use tabular/monospace figures for the
  digits specifically (`--masar-font-mono` stack:
  `ui-monospace, "Cascadia Code", Consolas, monospace`) so digit width doesn't
  jitter as the value climbs, while surrounding words stay in IBM Plex Sans
  Arabic. Count-up duration = `durations.counterFrames` (45f / 1.5s). **No
  overshoot on the digits themselves** — a number that overshoots past its
  true value and settles back reads as wrong/buggy data on a rigor-obsessed
  civic product. Instead allow a small *container* scale-punch
  (1.0→1.04→1.0, `snappy` spring) around the number at the instant it lands,
  as a landed/confirmed micro-beat that doesn't touch the digits.
- **Implementation note**: for the one hard-sync moment (S3's beat-drop under
  the logo wipe), precompute the spring's settling time (Remotion's
  `measureSpring()`) rather than assuming a fixed duration, and place the
  audio hit at that computed frame.

## Evidence chip

Mirrors the product's own tone/soft-background pattern
(`.desk-tag[data-tone="…"] { color: var(--masar-…); background:
var(--masar-…-soft); }` in `masar-desk.css`), just turned up to video scale.
Chips map onto Masar's real evidence ladder: `مُثبَت عملياً` (measured/observed,
`masar-trafficload.js`) at the top, down through the model's `model-derived` /
`synthetic` tiers (`deck-manifest.json`).

| Chip | Text color | Soft background | Evidence meaning |
|---|---|---|---|
| `chipProven` | `#2C7351` (`--masar-success`) | `#E4F1EA` (`--masar-success-soft`) | Measured / proven-in-practice — "مُثبَت عملياً" |
| `chipVerified` | `#2C6E9D` (`--masar-info`) | `#E6F0F7` (`--masar-info-soft`) | Cross-checked against an official/external published source |
| `chipExpected` | `#8C5C1C` (`--masar-warning`/`--masar-accent`, same hex in tokens.css) | `#F4EDE1` (`--masar-warning-soft`) | Inferred/expected from a model or experiment — "متوقَّع من تجربة" |
| `chipScenario` | `#626B76` (`--masar-faint`) | `#ECEFF2` (`--masar-canvas`) | Illustrative/synthetic scenario — lowest tier, deliberately neutral (not red — it isn't an error, just unproven) |

All four pairs verified ≥4.5:1 (chipVerified ≈4.65:1, chipScenario ≈4.69:1,
chipProven ≈4.91:1, chipExpected ≈4.93:1 — see `design-tokens.json._soft` for
the exact companion hexes).

- **Shape**: pill, radius = `--masar-radius-pill` (999px).
- **Type**: ~24px, medium weight (500), small letter-spacing — one step under
  `type.caption` (28px) since it is explicitly secondary to the number/claim
  it annotates, never the loudest thing in frame.
- **Docking**: lower-right of its associated number/claim, slight baseline
  overlap — reads as a footnote-badge, not a separate element.
- **Opacity**: solid pill (100% background), not translucent-over-video — it
  must stay legible sitting on top of screenshots or B-roll, unlike a
  glass/translucent chip which would fail contrast unpredictably over photo
  content.
- **Timing**: pops in with `durations.chipInFrames` (12f) on the `snappy`
  spring, always synced to the moment its number/claim lands, never earlier.

## Logo treatment

Two source files (both under `Baladiyathon/presentation/assets/brand/`,
already prepared as a light/dark pair — no recoloring needed):
- **Dark grounds (S3, S6)**:
  `C:\Users\wasan\Downloads\Swarm\Baladiyathon\presentation\assets\brand\masar-logo-white.png`
- **Light grounds, if a corner-bug treatment is ever added to S4** (matching
  the judging deck's own `.corner-logo` convention):
  `C:\Users\wasan\Downloads\Swarm\Baladiyathon\presentation\assets\brand\masar-logo.png`
  (identical artwork to the packaged
  `Baladiyathon\output\submission\masar-logo.png`, which is the same file
  staged for submission).

Both are flat raster PNGs (no SVG source was found in the repo), so treatments
need to work as mask/opacity operations on a filled shape — a true vector
pen-stroke "draw-on" isn't achievable without re-vectorizing the mark, which
is out of scope for this spec.

- **S3 reveal**: mask-wipe via `clip-path` inset, revealing **right-to-left**
  (honoring RTL — the wipe should feel like it originates from the same edge
  Arabic text originates from), timed so the wipe's completion lands exactly
  on the music's beat-drop. Wordmark cross-fades/slides up ~6–9 frames after
  the mark, settling on the `heavy` spring — a confident, weighty arrival, not
  a bouncy pop.
- **S6 reveal**: calmer — no wipe (that gesture is spent at S3). Scale-settle
  from 0.92 → 1.0 on the `smooth` spring, appearing alongside the closing
  tagline rather than announcing itself.
- Keep both logo beats on the dark ink ground (white variant) so S3 and S6
  visually bookend each other — a standard three-act mirroring device.

## Music direction

BPM ~78–86 at the open, stepping up to ~100–110 from S3 onward; the "step up"
should read as an energy/arrangement jump, not just a click-track number.

- **S1 Hook (0–8s)**: sparse — low sustained pad/drone + a faint pulse.
  Unresolved tension, human frustration.
- **S2 Cost (8–18s)**: same tempo, percussion/ticking texture enters and
  thickens as the counters climb — mounting urgency, no tempo change yet (so
  the real jump lands cleanly at S3).
- **S3 Turn + logo (18–25s)**: **the beat drop lands exactly on the logo's
  wipe-reveal frame** (see Motion language implementation note on
  precomputing the spring settle time for this sync). Harmony brightens
  (major-key lift / added top synth layer).
- **S4 Product proof (25–55s)**: sustained elevated energy, steady and
  functional rather than climactic — a confident groove under the
  screenshots; a light filter-sweep every ~10s can mark sub-beats without
  staging a second "drop."
- **S5 Trust (55–65s)**: **thins out** — pull most percussion/bass, leave a
  simple pad/piano motif. Visual quiet (S5 is the calmest-looking scene, see
  above) matches audio quiet here.
- **S6 Close (65–75s)**: a warmer, pulled-back variant of the S3 motif — a
  coda, not a second drop. Final chord/hit lands with the logo's settle; a
  short tail of near-silence after the logo is still, before the hard stop.

**Sound effects (optional layer)**: one whoosh (~120–180ms, filtered
noise-sweep) on each of the 5 scene transitions; one soft resolving
chime/tick exactly when each counter lands on its final value (doubling as
the cue for that number's chip pop-in) rather than ticking every digit
change, which would read as noisy; one low thud reinforcing the S3 beat-drop
logo landing.

## Phone-readability rules

- **Minimum on-screen text size**: never below `type.caption` (28px @1920,
  chosen so it still reads at small preview scale — see the type-scale
  reasoning below); `type.body` (40px) for any sentence-level claim;
  `type.hero`/`type.h1` reserved for headline beats only. (`type.hero` = 128px
  was sized against a rough worst-case phone-preview scale-down of ~5×,
  landing at a legible ~25px effective headline size even in a cramped
  in-feed player — this is why the video's type scale is far larger than the
  in-product UI scale of 13–35px in `masar-tokens.css`: a UI is read up close
  on a monitor, a video headline is read small and often in motion.)
- **Max 2 lines** per text block, always — if an Arabic line is too long, cut
  or rewrite the copy rather than wrap to a 3rd line.
- **Contrast**: use only the pairs verified in `design-tokens.json` (all
  ≥4.5:1). Never place a text token color directly on an unpredictable
  screenshot/photo background without a scrim (a bottom-anchored gradient
  scrim, black 0%→transparent ~40% up the frame, or a solid safe-area matte
  behind the caption) — the 4.5:1 guarantee only holds against the known flat
  brand surfaces it was computed against.
- **Duration on screen**: every text block stays **≥1.8s** minimum. For
  anything longer than ~12 Arabic words, extend further (~+0.35s per word
  past 5) so an average reader — not a speed-reader, and the audience is 8
  judges from mixed fields, some likely skimming while also listening — can
  finish reading before it's replaced, even if the voiceover itself moves
  faster.

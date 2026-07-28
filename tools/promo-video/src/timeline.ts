// ============================================================================
// timeline.ts — single source of truth for scene durations & transitions.
//
// Target: 2250 frames @ 30fps (75s) EXACTLY.
//
// <TransitionSeries> overlaps adjacent scenes during each fade(), so the
// rendered total = sum(scene durations) - sum(transition durations).
// With 6 scenes there are 5 transitions. At 12 frames each, that is
// 60 frames of overlap we must compensate for:
//
//   sum(scene durations) - 5 * 12 = 2250
//   sum(scene durations)          = 2310
//
// The original (pre-transition) scene plan totalled exactly 2250 frames:
//   S1 240 + S2 300 + S3 210 + S4 900 + S5 300 + S6 300 = 2250
//
// The extra 60 frames are distributed as +6 frames on each side of every
// internal boundary (half of the 12-frame transition on each neighbour),
// so every scene keeps roughly its planned share of screen time instead of
// losing content to the crossfade:
//
//   scene   planned   pad (touching transitions)   final
//   S1        240      +6  (only S1-S2)              246
//   S2        300      +6 (S1-S2) +6 (S2-S3) = +12    312
//   S3        210      +6 (S2-S3) +6 (S3-S4) = +12    222
//   S4        900      +6 (S3-S4) +6 (S4-S5) = +12    912
//   S5        300      +6 (S4-S5) +6 (S5-S6) = +12    312
//   S6        300      +6  (only S5-S6)               306
//   ---------------------------------------------------------
//   sum      2250                    +60             2310
//
// Verify: 2310 (sum of scene durations) - 60 (5 transitions x 12 frames)
//        = 2250 ✅ matches TOTAL_DURATION below.
//
// Each scene component subdivides ITS OWN padded duration internally
// (local frame 0..durationInFrames-1, via useCurrentFrame()) — no scene
// needs to know about the other scenes or the transitions.
// ============================================================================

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_DURATION = 2250;
export const TRANSITION_DURATION = 12;

export const SCENE_DURATIONS = {
  s1: 246,
  s2: 312,
  s3: 222,
  s4: 912,
  s5: 312,
  s6: 306,
} as const;

export type SceneKey = keyof typeof SCENE_DURATIONS;

// Fail fast in dev/Studio if the arithmetic above is ever changed without
// keeping the total in sync (e.g. someone edits SCENE_DURATIONS by hand).
const sceneKeys = Object.keys(SCENE_DURATIONS) as SceneKey[];
const sceneDurationSum = sceneKeys.reduce(
  (sum, key) => sum + SCENE_DURATIONS[key],
  0,
);
const transitionCount = sceneKeys.length - 1;
const computedTotal = sceneDurationSum - transitionCount * TRANSITION_DURATION;

if (computedTotal !== TOTAL_DURATION) {
  throw new Error(
    `timeline.ts arithmetic is broken: ${sceneDurationSum} - (${transitionCount} x ${TRANSITION_DURATION}) = ${computedTotal}, expected ${TOTAL_DURATION}. ` +
      `Adjust SCENE_DURATIONS or TRANSITION_DURATION so the sum matches again.`,
  );
}

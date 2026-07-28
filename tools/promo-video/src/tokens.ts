// ============================================================================
// tokens.ts — design tokens, merged from docs/design-tokens.json (brand pass).
// Palette source of truth: Baladiyathon/presentation/masar-tokens.css. The film
// uses the product's own surfaces so video and product read as one brand;
// --masar-ink (#15202B) is the product's only sanctioned dark ground and is
// the film's dark hinge color (S1/S3/S6). All text pairs verified >= 4.5:1
// against their listed surface in docs/design-spec.md.
// ============================================================================

export const colors = {
  bgDark: "#15202B", // --masar-ink
  bgDarkAlt: "#1C2A38", // ink raised one step (panel ground on ink)
  bgLight: "#ECEFF2", // --masar-canvas
  surface: "#FFFFFF", // --masar-surface
  accent: "#1D4E77", // --masar-primary
  accentSoft: "#E9F1F7", // --masar-primary-soft
  info: "#2C6E9D", // --masar-info — chip «مُتحقَّق خارجياً»
  infoSoft: "#E6F0F7",
  success: "#2C7351", // --masar-success — chip «مُثبَت عملياً»
  successSoft: "#E4F1EA",
  successOnInk: "#7FD6A6", // --masar-success-on-ink (light text on ink)
  danger: "#B23B32", // --masar-danger
  dangerSoft: "#F7E4E1",
  warning: "#8C5C1C", // --masar-warning — chip «متوقَّع من تجربة»
  warningSoft: "#F4EDE1",
  textOnDark: "#FFFFFF",
  textOnLight: "#15202B",
  textMuted: "#626B76", // --masar-faint — chip «سيناريو توسّع مشروط»
  overlay: "rgba(21, 32, 43, 0.55)",
} as const;

export const fontSize = {
  hero: 128,
  h1: 88,
  h2: 56,
  h3: 44,
  body: 40,
  caption: 28,
  kicker: 28,
  counter: 140,
  counterHero: 192,
} as const;

export const spacing = {
  xs: 8,
  sm: 16,
  md: 32,
  lg: 64,
  xl: 96,
  xxl: 140,
  safeX: 140,
  safeY: 100,
} as const;

export const radius = {
  sm: 12,
  md: 24,
  lg: 32,
  pill: 999,
} as const;

export const shadow = {
  // --masar-shadow-lg scaled to cinema size (design-spec § S4)
  panel: "0 48px 140px rgba(21, 32, 43, 0.32)",
  soft: "0 12px 32px rgba(21, 32, 43, 0.14)",
} as const;

// Spring presets from docs/design-tokens.json. Pass as `config` to spring().
export const springs = {
  smooth: { damping: 20, stiffness: 120, mass: 1 }, // text entrances, panel moves
  snappy: { damping: 15, stiffness: 200, mass: 0.7 }, // counters landing, chips
  heavy: { damping: 26, stiffness: 80, mass: 1.4 }, // logo reveal, punctuation
  gentle: { damping: 30, stiffness: 60, mass: 1 }, // secondary parallax drift
  bouncy: { damping: 12 }, // legacy key, unused by final scenes
} as const;

export const durations = {
  wordStaggerFrames: 3,
  sceneTransitionFrames: 12,
  counterFrames: 45,
  chipInFrames: 12,
} as const;

// --masar-ease from the product tokens, for fixed-duration interpolations.
export const EASE_BEZIER: [number, number, number, number] = [0.16, 1, 0.3, 1];

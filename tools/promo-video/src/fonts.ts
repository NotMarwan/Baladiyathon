import { loadFont } from "@remotion/google-fonts/IBMPlexSansArabic";

// Loaded once, shared by every scene/component. IBM Plex Sans Arabic exists in
// the installed @remotion/google-fonts version (verified against
// node_modules/@remotion/google-fonts) so no Cairo fallback was needed.
const loaded = loadFont("normal", {
  weights: ["400", "600", "700"],
  // latin too: Latin digits and "GAO / FHWA"-style tokens must not fall back
  // to a serif system font mid-sentence.
  subsets: ["arabic", "latin"],
});

export const fontFamily = loaded.fontFamily;
export const waitForFont = loaded.waitUntilDone;

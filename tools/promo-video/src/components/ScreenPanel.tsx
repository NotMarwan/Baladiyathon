import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { MISSING_SCREENS } from "../content";
import { fontFamily } from "../fonts";
import { colors, fontSize, radius, shadow } from "../tokens";
import { EASE_BEZIER } from "../tokens";
import { Easing } from "remotion";

export interface ScreenPanelProps {
  /** filename relative to public/screens/, e.g. "home.png" */
  src: string;
  startScale?: number;
  endScale?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  durationInFrames: number;
  /** panel width as % of composition width (design spec: 78–85 for S4) */
  widthPct?: number;
  /** static placement offset, px — separate from the Ken-Burns drift */
  offsetX?: number;
  offsetY?: number;
}

const masarEase = Easing.bezier(...EASE_BEZIER);

/**
 * public/screens/ image in a rounded, shadowed panel with a Ken-Burns
 * pan/zoom on the product's own easing curve. Missing files (per
 * MISSING_SCREENS) render a labeled placeholder so Studio stays usable.
 */
export const ScreenPanel: React.FC<ScreenPanelProps> = ({
  src,
  startScale = 1,
  endScale = 1.08,
  startX = 0,
  startY = 0,
  endX = 0,
  endY = 0,
  durationInFrames,
  widthPct = 72,
  offsetX = 0,
  offsetY = 0,
}) => {
  const frame = useCurrentFrame();
  const opts = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: masarEase,
  } as const;

  const scale = interpolate(
    frame,
    [0, durationInFrames],
    [startScale, endScale],
    opts,
  );
  const x = interpolate(frame, [0, durationInFrames], [startX, endX], opts);
  const y = interpolate(frame, [0, durationInFrames], [startY, endY], opts);

  const isMissing = MISSING_SCREENS[src] === true;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: `${widthPct}%`,
          aspectRatio: "16 / 9",
          borderRadius: radius.lg,
          overflow: "hidden",
          boxShadow: shadow.panel,
          transform: `translate(${offsetX + x}px, ${offsetY + y}px) scale(${scale})`,
          backgroundColor: colors.surface,
        }}
      >
        {isMissing ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              border: `2px dashed ${colors.textMuted}`,
              borderRadius: radius.lg,
              color: colors.textMuted,
              fontFamily,
              fontSize: fontSize.body,
            }}
          >
            <span dir="rtl">لقطة الشاشة قيد الانتظار</span>
            <span style={{ fontSize: fontSize.caption, direction: "ltr" }}>
              public/screens/{src}
            </span>
          </div>
        ) : (
          <Img
            src={staticFile(`screens/${src}`)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
};

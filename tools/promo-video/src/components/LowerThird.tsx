import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { colors, fontSize, radius, spacing, springs } from "../tokens";

export interface LowerThirdProps {
  text: string;
  delay?: number;
}

/** Small caption bar anchored bottom-right (kept physically bottom-right per brief, regardless of RTL). */
export const LowerThird: React.FC<LowerThirdProps> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: springs.smooth,
  });
  const opacity = Math.min(Math.max(progress, 0), 1);
  const translateY = (1 - progress) * 20;

  return (
    <div
      dir="rtl"
      style={{
        position: "absolute",
        right: spacing.lg,
        bottom: spacing.lg,
        opacity,
        transform: `translateY(${translateY}px)`,
        backgroundColor: colors.overlay,
        color: colors.textOnDark,
        borderRadius: radius.sm,
        padding: `${spacing.xs}px ${spacing.md}px`,
        fontFamily,
        fontSize: fontSize.caption,
        fontWeight: 600,
        textAlign: "right",
      }}
    >
      {text}
    </div>
  );
};

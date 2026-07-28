import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { colors, fontSize, radius, spacing, springs } from "../tokens";

export type EvidenceChipColorKey =
  | "accent"
  | "success" // مُثبَت عملياً
  | "verified" // مُتحقَّق خارجياً
  | "warning" // متوقَّع من تجربة
  | "danger"
  | "muted"; // سيناريو توسّع مشروط

export interface EvidenceChipProps {
  label: string;
  colorKey: EvidenceChipColorKey;
  delay?: number;
}

const colorMap: Record<
  EvidenceChipColorKey,
  { bg: string; fg: string; border: string }
> = {
  accent: { bg: colors.accentSoft, fg: colors.accent, border: colors.accent },
  success: {
    bg: colors.successSoft,
    fg: colors.success,
    border: colors.success,
  },
  verified: { bg: colors.infoSoft, fg: colors.info, border: colors.info },
  warning: {
    bg: colors.warningSoft,
    fg: colors.warning,
    border: colors.warning,
  },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger },
  muted: {
    bg: colors.bgLight,
    fg: colors.textMuted,
    border: colors.textMuted,
  },
};

/** Small solid pill docked near a number/claim as its evidence-class tag. */
export const EvidenceChip: React.FC<EvidenceChipProps> = ({
  label,
  colorKey,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = colorMap[colorKey];

  const progress = spring({
    frame: frame - delay,
    fps,
    config: springs.snappy,
  });
  const opacity = Math.min(Math.max(progress, 0), 1);
  const translateX = (1 - progress) * 24;

  return (
    <div
      dir="rtl"
      style={{
        display: "inline-flex",
        alignItems: "center",
        opacity,
        transform: `translateX(${translateX}px)`,
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        borderRadius: radius.pill,
        padding: `${spacing.xs}px ${spacing.md}px`,
        fontFamily,
        fontSize: fontSize.caption - 4,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

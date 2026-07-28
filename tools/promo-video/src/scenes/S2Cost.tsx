import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CounterNumber } from "../components/CounterNumber";
import { EvidenceChip } from "../components/EvidenceChip";
import { KineticText } from "../components/KineticText";
import { content, StatBlock } from "../content";
import { fontFamily } from "../fonts";
import { colors, durations, fontSize, radius, spacing } from "../tokens";

// Entrance / counter-start frames per stat (RTL: first = rightmost = most
// important). Counters land at start + counterFrames; each chip pops on land.
const BLOCK_DELAYS = [10, 95, 180];
const COUNTER_STARTS = [30, 115, 200];

const CapacityBar: React.FC<{
  from: number;
  to: number;
  startFrame: number;
}> = ({ from, to, startFrame }) => {
  const frame = useCurrentFrame();
  const value = interpolate(
    frame,
    [startFrame, startFrame + durations.counterFrames],
    [from, to],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const max = Math.max(to, 100);
  const markerPct = (100 / max) * 100;
  const fillPct = (value / max) * 100;
  const overCapacity = value > 100;

  return (
    <div dir="rtl" style={{ width: 430, marginTop: spacing.sm }}>
      <div
        style={{
          position: "relative",
          height: 16,
          borderRadius: radius.pill,
          backgroundColor: colors.bgLight === "#ECEFF2" ? "#DDE2E7" : "#DDE2E7",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            insetInlineStart: 0,
            top: 0,
            height: "100%",
            width: `${fillPct}%`,
            borderRadius: radius.pill,
            backgroundColor: overCapacity ? colors.danger : colors.warning,
          }}
        />
        <div
          style={{
            position: "absolute",
            insetInlineStart: `${markerPct}%`,
            top: -6,
            width: 3,
            height: 28,
            backgroundColor: colors.textOnLight,
          }}
        />
      </div>
      <div
        style={{
          fontFamily,
          fontSize: fontSize.caption - 6,
          color: colors.textMuted,
          marginTop: 6,
        }}
      >
        العلامة = سعة الشارع الكاملة
      </div>
    </div>
  );
};

const Stat: React.FC<{ stat: StatBlock; index: number }> = ({
  stat,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: frame - BLOCK_DELAYS[index],
    fps,
    config: { damping: 20, stiffness: 120, mass: 1 },
  });
  const counterStart = COUNTER_STARTS[index];
  const landFrame = counterStart + durations.counterFrames;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: spacing.sm,
        opacity: Math.min(Math.max(enter, 0), 1),
        transform: `translateY(${(1 - enter) * 36}px)`,
        maxWidth: 560,
      }}
    >
      <div
        dir="rtl"
        style={{
          fontFamily,
          fontSize: fontSize.caption,
          color: colors.textMuted,
          fontWeight: 500,
        }}
      >
        {stat.label}
      </div>
      <CounterNumber
        from={stat.from}
        to={stat.to}
        startFrame={counterStart}
        durationInFrames={durations.counterFrames}
        suffix={stat.suffix}
        style={{
          color: index === 2 ? colors.textOnLight : colors.danger,
        }}
      />
      {stat.capacityBar ? (
        <CapacityBar from={stat.from} to={stat.to} startFrame={counterStart} />
      ) : null}
      <EvidenceChip
        label={stat.chip}
        colorKey={stat.chipColor}
        delay={landFrame}
      />
    </div>
  );
};

/**
 * S2 — Cost. First light reveal: three real numbers, RTL row (most important
 * rightmost), each with its evidence chip (script 03–05, adjusted to captured
 * screenshots — see content.ts header).
 */
export const S2Cost: React.FC = () => {
  const c = content.s2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bgLight,
        justifyContent: "center",
        paddingInline: spacing.safeX,
      }}
    >
      <div
        dir="rtl"
        style={{
          display: "flex",
          flexDirection: "row",
          gap: spacing.lg,
          alignItems: "flex-start",
        }}
      >
        {c.stats.map((stat, i) => (
          <Stat key={stat.label} stat={stat} index={i} />
        ))}
      </div>
      <div style={{ marginTop: spacing.xl, alignSelf: "flex-end" }}>
        <KineticText
          text={c.closing}
          delay={255}
          style={{
            fontSize: fontSize.body,
            color: colors.textOnLight,
            fontWeight: 600,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

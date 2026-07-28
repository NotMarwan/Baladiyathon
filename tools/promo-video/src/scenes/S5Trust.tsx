import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Series,
  useCurrentFrame,
} from "remotion";
import { EvidenceChip } from "../components/EvidenceChip";
import { FadeSeq } from "../components/FadeSeq";
import { KineticText } from "../components/KineticText";
import { ScreenPanel } from "../components/ScreenPanel";
import { content } from "../content";
import { fontFamily } from "../fonts";
import { colors, fontSize, spacing } from "../tokens";
import { SCENE_DURATIONS } from "../timeline";

const RECALC_DURATION = 120;
const OSRM_DURATION = 96;
const LADDER_DURATION = SCENE_DURATIONS.s5 - RECALC_DURATION - OSRM_DURATION;

const RecalcBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const c = content.s5.recalc;

  // Crossfade before -> after at the midpoint: the same screen, a changed
  // input, a recomputed number — "live, not canned" in one visual.
  const afterOpacity = interpolate(frame, [52, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        <ScreenPanel
          src={c.before}
          durationInFrames={RECALC_DURATION}
          widthPct={60}
          offsetX={-300}
          offsetY={70}
          startScale={1}
          endScale={1.05}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: afterOpacity }}>
        <ScreenPanel
          src={c.after}
          durationInFrames={RECALC_DURATION}
          widthPct={60}
          offsetX={-300}
          offsetY={70}
          startScale={1}
          endScale={1.05}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 150,
          right: spacing.safeX,
          width: 620,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        <KineticText
          text={c.heading}
          delay={4}
          style={{
            fontSize: fontSize.h2,
            color: colors.textOnLight,
            fontWeight: 700,
          }}
        />
        <KineticText
          text={c.sub}
          delay={18}
          style={{
            fontSize: fontSize.caption,
            color: colors.textMuted,
            fontWeight: 500,
            marginTop: 10,
          }}
        />
      </div>
    </>
  );
};

const OsrmBeat: React.FC = () => {
  const c = content.s5.osrm;
  return (
    <>
      <ScreenPanel
        src={c.sideScreen}
        durationInFrames={OSRM_DURATION}
        widthPct={38}
        offsetX={-500}
        offsetY={140}
        startScale={1}
        endScale={1.04}
      />
      <div
        dir="rtl"
        style={{
          position: "absolute",
          bottom: 96,
          left: 210,
          fontFamily,
          fontSize: fontSize.caption - 6,
          color: colors.textMuted,
        }}
      >
        {c.sideCaption}
      </div>
      <div
        style={{
          position: "absolute",
          top: 190,
          right: spacing.safeX,
          width: 760,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: spacing.sm,
        }}
      >
        <KineticText
          text={c.heading}
          delay={4}
          style={{
            fontSize: fontSize.h2,
            color: colors.textOnLight,
            fontWeight: 700,
          }}
        />
        <KineticText
          text={c.sub}
          delay={18}
          style={{
            fontSize: fontSize.body,
            color: colors.textMuted,
            fontWeight: 500,
          }}
        />
        <EvidenceChip label={c.chip} colorKey={c.chipColor} delay={40} />
      </div>
    </>
  );
};

const LadderBeat: React.FC = () => {
  const c = content.s5.ladder;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "flex-end",
        paddingInline: spacing.safeX,
      }}
    >
      <KineticText
        text={c.heading}
        delay={4}
        style={{
          fontSize: fontSize.h2,
          color: colors.textOnLight,
          fontWeight: 700,
        }}
      />
      <div
        dir="rtl"
        style={{
          display: "flex",
          gap: spacing.sm,
          marginTop: spacing.md,
          flexWrap: "wrap",
          justifyContent: "flex-start",
        }}
      >
        {c.chips.map((chip, i) => (
          <EvidenceChip
            key={chip.label}
            label={chip.label}
            colorKey={chip.colorKey}
            delay={24 + i * 12}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/**
 * S5 — Trust, the quiet beat on plain surface: live recalc (not canned),
 * external calibration, then the full evidence ladder (script 15–17).
 */
export const S5Trust: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.surface }}>
      <Series>
        <Series.Sequence durationInFrames={RECALC_DURATION}>
          <FadeSeq durationInFrames={RECALC_DURATION} fadeIn={10} fadeOut={10}>
            <RecalcBeat />
          </FadeSeq>
        </Series.Sequence>
        <Series.Sequence durationInFrames={OSRM_DURATION}>
          <FadeSeq durationInFrames={OSRM_DURATION} fadeIn={10} fadeOut={10}>
            <OsrmBeat />
          </FadeSeq>
        </Series.Sequence>
        <Series.Sequence durationInFrames={LADDER_DURATION}>
          <FadeSeq durationInFrames={LADDER_DURATION} fadeIn={10} fadeOut={0}>
            <LadderBeat />
          </FadeSeq>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

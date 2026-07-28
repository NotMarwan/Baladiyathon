import React from "react";
import {
  AbsoluteFill,
  Series,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CounterNumber } from "../components/CounterNumber";
import { EvidenceChip } from "../components/EvidenceChip";
import { FadeSeq } from "../components/FadeSeq";
import { KineticText } from "../components/KineticText";
import { LowerThird } from "../components/LowerThird";
import { ScreenPanel } from "../components/ScreenPanel";
import { content } from "../content";
import { fontFamily } from "../fonts";
import {
  colors,
  durations,
  fontSize,
  radius,
  spacing,
  springs,
} from "../tokens";
import { SCENE_DURATIONS } from "../timeline";

// 6 beats x 152f = 912f == SCENE_DURATIONS.s4. One claim per beat, all on the
// light canvas (design spec: S4 never dips to ink; beat handoffs dissolve
// through light via FadeSeq).
const BEAT_COUNT = 6;
const BEAT = SCENE_DURATIONS.s4 / BEAT_COUNT; // 152

const BeatText: React.FC<{
  heading: string;
  sub: string;
  chip?: string;
  chipColor?: React.ComponentProps<typeof EvidenceChip>["colorKey"];
}> = ({ heading, sub, chip, chipColor }) => (
  <AbsoluteFill
    style={{
      alignItems: "flex-end",
      padding: `${spacing.xl - 20}px ${spacing.safeX}px 0`,
    }}
  >
    <KineticText
      text={heading}
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
        alignItems: "center",
        gap: spacing.sm,
        marginTop: 10,
      }}
    >
      <KineticText
        text={sub}
        delay={16}
        style={{
          fontSize: fontSize.caption,
          color: colors.textMuted,
          fontWeight: 500,
        }}
      />
      {chip ? (
        <EvidenceChip label={chip} colorKey={chipColor ?? "muted"} delay={34} />
      ) : null}
    </div>
  </AbsoluteFill>
);

const Beat1Desk: React.FC = () => {
  const c = content.s4.b1;
  return (
    <>
      <ScreenPanel
        src={c.screen}
        durationInFrames={BEAT}
        widthPct={76}
        offsetY={92}
        startScale={0.96}
        endScale={1.06}
        endY={-10}
      />
      <BeatText
        heading={c.heading}
        sub={c.sub}
        chip={c.chip}
        chipColor={c.chipColor}
      />
    </>
  );
};

const Beat2Schedule: React.FC = () => {
  const c = content.s4.b2;
  return (
    <>
      <ScreenPanel
        src={c.screen}
        durationInFrames={BEAT}
        widthPct={56}
        offsetX={-330}
        offsetY={64}
        startScale={1}
        endScale={1.1}
        endX={30}
      />
      <div
        style={{
          position: "absolute",
          top: 120,
          right: spacing.safeX,
          width: 640,
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
        <div
          dir="rtl"
          style={{
            fontFamily,
            fontSize: fontSize.caption,
            color: colors.textMuted,
            fontWeight: 500,
            marginTop: 6,
          }}
        >
          {c.counterLabel}
        </div>
        <CounterNumber
          from={c.counterFrom}
          to={c.counterTo}
          startFrame={34}
          durationInFrames={durations.counterFrames + 20}
          suffix={c.counterSuffix}
          style={{ color: colors.success }}
        />
        <KineticText
          text={c.sub}
          delay={60}
          style={{
            fontSize: fontSize.body - 6,
            color: colors.success,
            fontWeight: 700,
          }}
        />
        <EvidenceChip
          label={c.chip}
          colorKey={c.chipColor}
          delay={34 + durations.counterFrames + 20}
        />
      </div>
      <LowerThird text={c.lower} delay={80} />
    </>
  );
};

const Beat3Routes: React.FC = () => {
  const c = content.s4.b3;
  return (
    <>
      <ScreenPanel
        src={c.screen}
        durationInFrames={BEAT}
        widthPct={76}
        offsetY={92}
        startScale={1.02}
        endScale={1.12}
        endX={-40}
      />
      <BeatText
        heading={c.heading}
        sub={c.sub}
        chip={c.chip}
        chipColor={c.chipColor}
      />
    </>
  );
};

const DigOnceDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = content.s4.b4;

  const converge = spring({ frame: frame - 34, fps, config: springs.smooth });
  const gap = (1 - Math.min(Math.max(converge, 0), 1)) * 96;
  const mergedIn = spring({ frame: frame - 74, fps, config: springs.snappy });
  const separateOpacity = frame < 74 ? 1 : Math.max(0, 1 - (frame - 74) / 8);
  const mergedOpacity = Math.min(Math.max(mergedIn, 0), 1);

  const barBase: React.CSSProperties = {
    width: 900,
    height: 76,
    borderRadius: radius.pill,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingInline: spacing.md,
    fontFamily,
    fontSize: fontSize.caption,
    fontWeight: 600,
    boxSizing: "border-box",
  };

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", paddingTop: 90 }}
    >
      {/* the street the two permits both want to dig */}
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 4,
          backgroundColor: "#D6DBE1",
          borderRadius: 2,
        }}
      />
      <div
        dir="rtl"
        style={{
          ...barBase,
          position: "absolute",
          transform: `translateY(${-gap}px)`,
          backgroundColor: colors.accentSoft,
          border: `2px solid ${colors.accent}`,
          color: colors.accent,
          opacity: separateOpacity,
        }}
      >
        {c.permitA}
      </div>
      <div
        dir="rtl"
        style={{
          ...barBase,
          position: "absolute",
          transform: `translateY(${gap}px)`,
          backgroundColor: colors.infoSoft,
          border: `2px solid ${colors.info}`,
          color: colors.info,
          opacity: separateOpacity,
        }}
      >
        {c.permitB}
      </div>
      <div
        dir="rtl"
        style={{
          ...barBase,
          position: "absolute",
          width: 1000,
          backgroundColor: colors.successSoft,
          border: `2px solid ${colors.success}`,
          color: colors.success,
          opacity: mergedOpacity,
          transform: `scale(${0.94 + 0.06 * mergedOpacity})`,
          justifyContent: "center",
          fontSize: fontSize.body - 8,
          fontWeight: 700,
        }}
      >
        {c.merged}
      </div>
    </AbsoluteFill>
  );
};

const Beat4DigOnce: React.FC = () => {
  const c = content.s4.b4;
  return (
    <>
      <DigOnceDiagram />
      <BeatText
        heading={c.heading}
        sub={c.sub}
        chip={c.chip}
        chipColor={c.chipColor}
      />
    </>
  );
};

const Beat5Refusal: React.FC = () => {
  const c = content.s4.b5;
  return (
    <>
      <ScreenPanel
        src={c.screen}
        durationInFrames={BEAT}
        widthPct={76}
        offsetY={92}
        startScale={1}
        endScale={1.12}
        endX={50}
        endY={25}
      />
      <BeatText heading={c.heading} sub={c.sub} />
      <LowerThird text={c.lower} delay={60} />
    </>
  );
};

const Beat6PublicMap: React.FC = () => {
  const c = content.s4.b6;
  return (
    <>
      <ScreenPanel
        src={c.screen}
        durationInFrames={BEAT}
        widthPct={76}
        offsetY={92}
        startScale={1.04}
        endScale={1.14}
        endY={-35}
      />
      <BeatText heading={c.heading} sub={c.sub} />
    </>
  );
};

/**
 * S4 — Product proof, the film's core: six real-product beats (script 08–14;
 * separation-of-duties rides the refusal beat's lower third).
 */
export const S4Product: React.FC = () => {
  const beats = [
    Beat1Desk,
    Beat2Schedule,
    Beat3Routes,
    Beat4DigOnce,
    Beat5Refusal,
    Beat6PublicMap,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgLight }}>
      <Series>
        {beats.map((Beat, i) => (
          <Series.Sequence key={i} durationInFrames={BEAT}>
            <FadeSeq durationInFrames={BEAT} fadeIn={10} fadeOut={10}>
              <Beat />
            </FadeSeq>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

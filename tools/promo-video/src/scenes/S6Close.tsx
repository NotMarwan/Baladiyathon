import React from "react";
import {
  AbsoluteFill,
  Img,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FadeSeq } from "../components/FadeSeq";
import { KineticText } from "../components/KineticText";
import { content } from "../content";
import { fontFamily } from "../fonts";
import { colors, fontSize, spacing, springs } from "../tokens";
import { SCENE_DURATIONS } from "../timeline";

const TAGLINE_DURATION = 140;
const STAMP_DURATION = SCENE_DURATIONS.s6 - TAGLINE_DURATION;

const LogoStamp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = content.s6;

  // Calmer than S3 (the wipe is spent): scale-settle 0.92 -> 1 on `smooth`,
  // subtitle follows, then everything holds still as the music resolves.
  const settle = spring({ frame, fps, config: springs.smooth });
  const p = Math.min(Math.max(settle, 0), 1);
  const subEnter = spring({ frame: frame - 22, fps, config: springs.smooth });
  const subP = Math.min(Math.max(subEnter, 0), 1);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: spacing.lg - 16,
      }}
    >
      <Img
        src={staticFile("brand/masar-logo-white.png")}
        style={{
          width: 560,
          opacity: p,
          transform: `scale(${0.92 + 0.08 * p})`,
        }}
      />
      <div
        dir="rtl"
        style={{
          fontFamily,
          fontSize: fontSize.h3,
          color: colors.textOnDark,
          fontWeight: 600,
          opacity: subP,
          transform: `translateY(${(1 - subP) * 14}px)`,
        }}
      >
        {c.logoSubtitle}
      </div>
    </AbsoluteFill>
  );
};

/**
 * S6 — Close: tagline, then the logo stamp with the official submission line.
 * Bookends S1/S3 on the same ink ground (script 18–19).
 */
export const S6Close: React.FC = () => {
  const c = content.s6;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      <Series>
        <Series.Sequence durationInFrames={TAGLINE_DURATION}>
          <FadeSeq durationInFrames={TAGLINE_DURATION} fadeIn={10} fadeOut={12}>
            <AbsoluteFill
              style={{ justifyContent: "center", alignItems: "center" }}
            >
              <KineticText
                text={c.tag1}
                delay={4}
                style={{
                  fontSize: fontSize.h1,
                  color: colors.textOnDark,
                  fontWeight: 700,
                  textAlign: "center",
                  justifyContent: "center",
                }}
              />
              <KineticText
                text={c.tag2}
                delay={22}
                style={{
                  fontSize: fontSize.h1,
                  color: colors.successOnInk,
                  fontWeight: 700,
                  marginTop: spacing.sm,
                  textAlign: "center",
                  justifyContent: "center",
                }}
              />
            </AbsoluteFill>
          </FadeSeq>
        </Series.Sequence>
        <Series.Sequence durationInFrames={STAMP_DURATION}>
          <FadeSeq durationInFrames={STAMP_DURATION} fadeIn={8} fadeOut={0}>
            <LogoStamp />
          </FadeSeq>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

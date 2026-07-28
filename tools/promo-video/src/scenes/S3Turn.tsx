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

const QUESTION_DURATION = 108;
const LOGO_DURATION = SCENE_DURATIONS.s3 - QUESTION_DURATION;

const LogoWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = content.s3;

  // Mask-wipe revealing right-to-left (same edge Arabic reading starts from).
  const wipe = spring({ frame, fps, config: springs.heavy });
  const clipLeft = (1 - Math.min(Math.max(wipe, 0), 1)) * 100;

  const subEnter = spring({
    frame: frame - 26,
    fps,
    config: springs.smooth,
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", gap: 40 }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 45%, rgba(29, 78, 119, 0.35), transparent 55%)",
        }}
      />
      <Img
        src={staticFile("brand/masar-logo-white.png")}
        style={{
          width: 620,
          clipPath: `inset(0 0 0 ${clipLeft}%)`,
        }}
      />
      <div
        dir="rtl"
        style={{
          fontFamily,
          fontSize: fontSize.h3,
          color: colors.successOnInk,
          fontWeight: 600,
          opacity: Math.min(Math.max(subEnter, 0), 1),
          transform: `translateY(${(1 - subEnter) * 18}px)`,
        }}
      >
        {c.logoSubtitle}
      </div>
    </AbsoluteFill>
  );
};

/**
 * S3 — Turn. The "what if" question on ink, then the logo mask-wipe with one
 * accent glow — the film's beat-drop moment (script 06–07).
 */
export const S3Turn: React.FC = () => {
  const c = content.s3;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      <Series>
        <Series.Sequence durationInFrames={QUESTION_DURATION}>
          <FadeSeq durationInFrames={QUESTION_DURATION} fadeIn={8} fadeOut={12}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                paddingInline: spacing.safeX,
              }}
            >
              <KineticText
                text={c.line1}
                delay={0}
                style={{
                  fontSize: fontSize.h1,
                  color: colors.textOnDark,
                  fontWeight: 700,
                  textAlign: "center",
                  justifyContent: "center",
                }}
              />
              <KineticText
                text={c.line2}
                delay={16}
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

        <Series.Sequence durationInFrames={LOGO_DURATION}>
          <FadeSeq durationInFrames={LOGO_DURATION} fadeIn={6} fadeOut={0}>
            <LogoWipe />
          </FadeSeq>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

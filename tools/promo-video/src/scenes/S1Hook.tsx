import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { EvidenceChip } from "../components/EvidenceChip";
import { FadeSeq } from "../components/FadeSeq";
import { KineticText } from "../components/KineticText";
import { content } from "../content";
import { colors, fontSize, spacing } from "../tokens";
import { SCENE_DURATIONS } from "../timeline";

const QUOTE_DURATION = 150;
const QUESTION_DURATION = SCENE_DURATIONS.s1 - QUOTE_DURATION;

/**
 * S1 — Hook. Cold open on the resident's words over the product's sanctioned
 * dark ink. No logo, no UI, no numbers — the pain lands first (script 01–02).
 */
export const S1Hook: React.FC = () => {
  const c = content.s1;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      <Series>
        <Series.Sequence durationInFrames={QUOTE_DURATION}>
          <FadeSeq durationInFrames={QUOTE_DURATION} fadeIn={12} fadeOut={12}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "flex-end",
                paddingInline: spacing.safeX,
              }}
            >
              <KineticText
                text={c.quote1}
                delay={8}
                style={{
                  fontSize: fontSize.hero,
                  color: colors.textOnDark,
                  fontWeight: 700,
                  maxWidth: 1500,
                }}
              />
              <KineticText
                text={c.quote2}
                delay={26}
                style={{
                  fontSize: fontSize.hero,
                  color: colors.textOnDark,
                  fontWeight: 700,
                  maxWidth: 1500,
                }}
              />
              <div style={{ marginTop: spacing.md }}>
                <EvidenceChip label={c.attribution} colorKey="muted" delay={84} />
              </div>
            </AbsoluteFill>
          </FadeSeq>
        </Series.Sequence>

        <Series.Sequence durationInFrames={QUESTION_DURATION}>
          <FadeSeq durationInFrames={QUESTION_DURATION} fadeIn={8} fadeOut={0}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "flex-end",
                paddingInline: spacing.safeX,
              }}
            >
              <KineticText
                text={c.q1}
                delay={0}
                style={{
                  fontSize: fontSize.h1,
                  color: colors.textOnDark,
                  fontWeight: 700,
                }}
              />
              <KineticText
                text={c.q2}
                delay={18}
                style={{
                  fontSize: fontSize.h1,
                  color: colors.successOnInk,
                  fontWeight: 700,
                  marginTop: spacing.sm,
                }}
              />
            </AbsoluteFill>
          </FadeSeq>
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

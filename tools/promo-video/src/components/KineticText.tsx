import React, { CSSProperties } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../fonts";
import { springs } from "../tokens";

export interface KineticTextProps {
  text: string;
  /** frame at which the first word starts animating in */
  delay?: number;
  style?: CSSProperties;
  /** frames between each word's entrance start (stagger) */
  stagger?: number;
}

/**
 * Arabic RTL kinetic text. Splits on spaces and animates WORD-BY-WORD
 * (opacity + translateY spring) — never letter-level, since Arabic ligatures
 * break when individual letters are isolated/animated.
 */
export const KineticText: React.FC<KineticTextProps> = ({
  text,
  delay = 0,
  style,
  stagger = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ").filter(Boolean);

  return (
    <div
      dir="rtl"
      style={{
        display: "flex",
        flexWrap: "wrap",
        // Row flex + dir="rtl" mirrors the main axis, so "flex-start" is the
        // RTL reading start (visual right) — this right-aligns the block.
        justifyContent: "flex-start",
        textAlign: "right",
        fontFamily,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const wordDelay = delay + i * stagger;
        const progress = spring({
          frame: frame - wordDelay,
          fps,
          config: springs.smooth,
        });
        const opacity = Math.min(Math.max(progress, 0), 1);
        const translateY = (1 - progress) * 40;

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${translateY}px)`,
              marginInlineStart: i === 0 ? 0 : "0.28em",
              whiteSpace: "pre",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

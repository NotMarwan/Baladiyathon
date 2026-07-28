import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";
import { colors, fontSize, springs } from "../tokens";

export interface LogoRevealProps {
  text: string;
  subtitle?: string;
  /** when provided, renders an <Img> lockup instead of the placeholder text */
  logoSrc?: string;
  delay?: number;
}

/**
 * Placeholder logo lockup: huge type scale-spring + letter-spacing settle.
 * Pass `logoSrc` once a real SVG/PNG logo exists to swap in without touching
 * any scene that uses this component.
 */
export const LogoReveal: React.FC<LogoRevealProps> = ({
  text,
  subtitle,
  logoSrc,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const revealProgress = spring({
    frame: frame - delay,
    fps,
    config: springs.heavy,
  });
  const scale = interpolate(revealProgress, [0, 1], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(revealProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const letterSpacing = interpolate(revealProgress, [0, 1], [40, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subtitleProgress = spring({
    frame: frame - delay - 20,
    fps,
    config: springs.smooth,
  });
  const subtitleOpacity = Math.min(Math.max(subtitleProgress, 0), 1);
  const subtitleY = (1 - subtitleOpacity) * 16;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {logoSrc ? (
        <Img
          src={logoSrc}
          style={{ transform: `scale(${scale})`, opacity, maxWidth: "60%" }}
        />
      ) : (
        <div
          dir="rtl"
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: fontSize.hero,
            color: colors.textOnDark,
            transform: `scale(${scale})`,
            opacity,
            letterSpacing,
          }}
        >
          {text}
        </div>
      )}
      {subtitle ? (
        <div
          dir="rtl"
          style={{
            fontFamily,
            fontSize: fontSize.h3,
            color: colors.textMuted,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

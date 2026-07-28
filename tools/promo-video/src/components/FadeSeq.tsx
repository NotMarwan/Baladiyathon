import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export interface FadeSeqProps {
  durationInFrames: number;
  fadeIn?: number;
  fadeOut?: number;
  children: React.ReactNode;
}

/**
 * Wraps a beat's content in an opacity envelope so back-to-back beats inside a
 * <Series> read as dissolves (through whatever the scene background is) rather
 * than hard cuts. Scene-level transitions stay the job of TransitionSeries.
 */
export const FadeSeq: React.FC<FadeSeqProps> = ({
  durationInFrames,
  fadeIn = 10,
  fadeOut = 10,
  children,
}) => {
  const frame = useCurrentFrame();
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const inOpacity =
    fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], clamp) : 1;
  const outOpacity =
    fadeOut > 0
      ? interpolate(
          frame,
          [durationInFrames - fadeOut, durationInFrames],
          [1, 0],
          clamp,
        )
      : 1;
  const opacity = Math.min(inOpacity, outOpacity);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

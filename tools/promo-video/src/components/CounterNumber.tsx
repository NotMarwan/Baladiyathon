import React, { CSSProperties } from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "../fonts";
import { fontSize, springs } from "../tokens";

export interface CounterNumberProps {
  from: number;
  to: number;
  startFrame: number;
  durationInFrames: number;
  suffix?: string;
  style?: CSSProperties;
}

// Digits use the product's mono stack (--masar-font-mono) so widths never
// jitter mid-count; the digit run is bidi-isolated so grouping separators
// survive the surrounding RTL context. No overshoot on the digits themselves —
// a number passing its true value reads as buggy data on a civic product.
// Instead the container gets a 1.0→1.04→1.0 punch the instant the value lands.
const MONO_STACK = 'ui-monospace, "Cascadia Code", Consolas, monospace';

export const CounterNumber: React.FC<CounterNumberProps> = ({
  from,
  to,
  startFrame,
  durationInFrames,
  suffix = "",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const value = interpolate(
    frame,
    [startFrame, startFrame + durationInFrames],
    [from, to],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  const landFrame = startFrame + durationInFrames;
  const punchProgress = spring({
    frame: frame - landFrame,
    fps,
    config: springs.snappy,
  });
  const punch =
    frame < landFrame
      ? 0
      : Math.sin(Math.min(Math.max(punchProgress, 0), 1) * Math.PI);
  const scale = 1 + punch * 0.04;

  const formatted = Math.round(value).toLocaleString("en-US");

  return (
    <div
      dir="rtl"
      style={{
        fontFamily,
        fontSize: fontSize.counter,
        fontWeight: 700,
        display: "inline-block",
        transform: `scale(${scale})`,
        ...style,
      }}
    >
      <span
        style={{
          direction: "ltr",
          unicodeBidi: "isolate",
          fontFamily: MONO_STACK,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatted}
      </span>
      {suffix}
    </div>
  );
};

import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { S1Hook } from "./scenes/S1Hook";
import { S2Cost } from "./scenes/S2Cost";
import { S3Turn } from "./scenes/S3Turn";
import { S4Product } from "./scenes/S4Product";
import { S5Trust } from "./scenes/S5Trust";
import { S6Close } from "./scenes/S6Close";
import { SCENE_DURATIONS, TRANSITION_DURATION } from "./timeline";
import { colors } from "./tokens";

// See timeline.ts for the full duration arithmetic. Summary:
//   sum(SCENE_DURATIONS) [2310] - 5 transitions x 12f [60] = 2250 frames total.
const transitionTiming = linearTiming({ durationInFrames: TRANSITION_DURATION });

export const MasarLaunch: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      {/* Score synthesized deterministically (tools/promo-video docs); beat
          drop is timed to the S3 logo wipe. The film still works muted. */}
      <Audio src={staticFile("audio/score.wav")} />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s1}>
          <S1Hook />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={transitionTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s2}>
          <S2Cost />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={transitionTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s3}>
          <S3Turn />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={transitionTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s4}>
          <S4Product />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={transitionTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s5}>
          <S5Trust />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={transitionTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.s6}>
          <S6Close />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

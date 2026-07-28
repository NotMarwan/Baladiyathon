import React from "react";
import { Composition } from "remotion";
import { MasarLaunch } from "./MasarLaunch";
import { FPS, HEIGHT, TOTAL_DURATION, WIDTH } from "./timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MasarLaunch"
      component={MasarLaunch}
      durationInFrames={TOTAL_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};

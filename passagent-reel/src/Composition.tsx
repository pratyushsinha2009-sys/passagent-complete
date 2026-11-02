import {
  AbsoluteFill,
  Composition,
  Folder,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { Hook } from "./scenes/Hook";
import { Home } from "./scenes/Home";
import { Explain } from "./scenes/Explain";
import { Focus } from "./scenes/Focus";
import { Choices } from "./scenes/Choices";
import { Errors } from "./scenes/Errors";
import { Review } from "./scenes/Review";
import { Finale } from "./scenes/Finale";
import { C, clamp } from "./design";
export const PassAgentReel = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Audio
        src={staticFile("passagent-flow.wav")}
        premountFor={fps}
        volume={0.62}
      />
      <Series>
        <Series.Sequence
          name="01 · The hook"
          durationInFrames={3 * fps}
          premountFor={fps}
        >
          <Hook />
        </Series.Sequence>
        <Series.Sequence
          name="02 · The real homepage"
          durationInFrames={5 * fps}
          premountFor={fps}
        >
          <Home />
        </Series.Sequence>
        <Series.Sequence
          name="03 · Clear explanations"
          durationInFrames={5 * fps}
          premountFor={fps}
        >
          <Explain />
        </Series.Sequence>
        <Series.Sequence
          name="04 · Automatic focus"
          durationInFrames={5 * fps}
          premountFor={fps}
        >
          <Focus />
        </Series.Sequence>
        <Series.Sequence
          name="05 · Help me choose"
          durationInFrames={5 * fps}
          premountFor={fps}
        >
          <Choices />
        </Series.Sequence>
        <Series.Sequence
          name="06 · Catch mistakes"
          durationInFrames={4 * fps}
          premountFor={fps}
        >
          <Errors />
        </Series.Sequence>
        <Series.Sequence
          name="07 · Review and control"
          durationInFrames={5 * fps}
          premountFor={fps}
        >
          <Review />
        </Series.Sequence>
        <Series.Sequence
          name="08 · Chrome extension"
          durationInFrames={4 * fps}
          premountFor={fps}
        >
          <Finale />
        </Series.Sequence>
      </Series>
      <div
        style={{
          position: "absolute",
          bottom: 76,
          left: 82,
          right: 82,
          height: 3,
          background: "#82729433",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${interpolate(frame, [0, 36 * fps], [0, 100], clamp)}%`,
            background: C.violet,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
export const MyComposition = () => (
  <>
    <Composition
      id="PassAgent-Reel"
      component={PassAgentReel}
      durationInFrames={1080}
      fps={30}
      width={1080}
      height={1920}
    />
    <Folder name="Editable-Scenes">
      <Composition
        id="Hook"
        component={Hook}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Homepage"
        component={Home}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Explanations"
        component={Explain}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Automatic-Focus"
        component={Focus}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Help-Me-Choose"
        component={Choices}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Error-Checks"
        component={Errors}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Review"
        component={Review}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Chrome-Extension"
        component={Finale}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
      />
    </Folder>
  </>
);

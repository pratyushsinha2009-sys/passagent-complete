import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Scene,
  Title,
  Browser,
  PortalHeader,
  Field,
  AnimatedCaptions,
  C,
} from "../design";
export const Explain = () => {
  const f = useCurrentFrame() * 1.2;
  const { fps } = useVideoConfig();
  const typed = "Asha Mehta".slice(
    0,
    Math.max(0, Math.floor((f - 2.5 * fps) / (fps * 0.1))),
  );
  return (
    <Scene step="02 / UNDERSTAND" duration={5}>
      <Title>
        No more
        <br />
        <span style={{ color: C.violet }}>“what goes here?”</span>
      </Title>
      <Browser>
        <PortalHeader section="Account setup" />
        <Field
          label="Full name"
          active
          value={typed}
          tip="Type your full name as it appears in your supporting documents. Leave out titles such as Mr or Dr."
        />
        <Field label="Email address" />
        <div style={{ margin: "22px 34px", fontSize: 22, color: C.violetDark }}>
          ✦ One highlighted box. One clear explanation.
        </div>
      </Browser>
      <AnimatedCaptions
        speed={1.2}
        captions={[
          {
            text: "Understand exactly what to fill.",
            startMs: 300,
            endMs: 2800,
            timestampMs: null,
            confidence: null,
          },
          {
            text: "Simple words. Right beside the box.",
            startMs: 2800,
            endMs: 6000,
            timestampMs: null,
            confidence: null,
          },
        ]}
      />
    </Scene>
  );
};

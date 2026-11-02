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
export const Errors = () => {
  const f = useCurrentFrame() * 1.25;
  const { fps } = useVideoConfig();
  const fixed = f > 2.6 * fps;
  return (
    <Scene step="05 / CHECK" duration={4}>
      <Title>
        Catch a mistake.
        <br />
        <span style={{ color: C.peach }}>Keep moving.</span>
      </Title>
      <Browser height={800}>
        <PortalHeader section="Contact details" />
        <Field
          label="Email address"
          active
          error={!fixed}
          value={fixed ? "asha@example.com" : "asha@example"}
          tip={
            fixed
              ? "This email has the expected format. Check that it is the address you use."
              : "Check the email address. It should look like name@example.com."
          }
        />
        <div
          style={{
            margin: "45px 34px",
            borderRadius: 15,
            padding: "25px 30px",
            background: fixed ? "#F0F7E8" : "#FFF0E9",
            color: fixed ? "#53733B" : "#A45B42",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {fixed ? "✓ Format check passed" : "! Let’s check this answer first"}
        </div>
        <div
          style={{
            margin: "0 34px",
            fontSize: 24,
            lineHeight: 1.45,
            color: "#847992",
          }}
        >
          Also checks confirmation passwords
          <br />
          and impossible or future birth dates.
        </div>
      </Browser>
      <AnimatedCaptions
        speed={1.25}
        captions={[
          {
            text: "A helpful nudge before you continue.",
            startMs: 300,
            endMs: 2600,
            timestampMs: null,
            confidence: null,
          },
          {
            text: "Fix the answer. Get back on track.",
            startMs: 2600,
            endMs: 5000,
            timestampMs: null,
            confidence: null,
          },
        ]}
      />
    </Scene>
  );
};

import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  Scene,
  Title,
  Browser,
  PortalHeader,
  Field,
  AnimatedCaptions,
  Button,
  Cursor,
  C,
} from "../design";
export const Choices = () => {
  const f = useCurrentFrame() * 1.2;
  const { fps } = useVideoConfig();
  const described = f > 1.7 * fps;
  const confirmed = f > 4.2 * fps;
  return (
    <Scene step="04 / CHOOSE" duration={5}>
      <Title>
        Not sure?
        <br />
        <span style={{ color: C.violet }}>Let’s make it clear.</span>
      </Title>
      <Browser>
        <PortalHeader />
        <Field
          label="Employment type"
          active={confirmed}
          value={confirmed ? "Student" : "Choose an option  ⌄"}
        />
        <div
          style={{
            margin: "23px 34px",
            padding: 26,
            borderRadius: 13,
            border: "2px solid #D8C9FA",
            background: "#F5F1FF",
          }}
        >
          <b style={{ fontSize: 27, color: C.violetDark }}>✦ Help me choose</b>
          <p style={{ fontSize: 30, lineHeight: 1.25, margin: "18px 0" }}>
            Which description fits you?
          </p>
          <div
            style={{
              fontSize: 29,
              background: "white",
              border: "1px solid #D7CCE9",
              borderRadius: 8,
              padding: 17,
            }}
          >
            {described ? "I am studying  ⌄" : "Choose a description…  ⌄"}
          </div>
          {described && (
            <>
              <p style={{ fontSize: 26, color: "#65518F" }}>
                Suggested option: <b>Student</b>
                <br />
                Check that this describes you.
              </p>
              <Button>
                {confirmed
                  ? "✓ Selected after your confirmation"
                  : "Use “Student”"}
              </Button>
            </>
          )}
        </div>
        {described && !confirmed && (
          <Cursor x={550} y={530} click={f > 3.9 * fps} />
        )}
      </Browser>
      <AnimatedCaptions
        speed={1.2}
        captions={[
          {
            text: "Answer a simple follow-up.",
            startMs: 300,
            endMs: 2850,
            timestampMs: null,
            confidence: null,
          },
          {
            text: "Get a suggestion. You confirm the choice.",
            startMs: 2850,
            endMs: 6000,
            timestampMs: null,
            confidence: null,
          },
        ]}
      />
    </Scene>
  );
};

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
export const Focus = () => {
  const f = useCurrentFrame() * 1.2;
  const { fps } = useVideoConfig();
  const next = f > 3.2 * fps;
  return (
    <Scene step="03 / KEEP GOING" duration={5}>
      <Title>
        You type.
        <br />
        <span style={{ color: C.lime }}>It takes you next.</span>
      </Title>
      <Browser>
        <PortalHeader />
        <Field
          label="Given name"
          value={"Asha".slice(
            0,
            Math.max(0, Math.floor((f - 0.8 * fps) / (fps * 0.15))),
          )}
          active={!next}
          tip="Enter your first and middle name. Keep typing to wait, or choose Stay here."
        />
        <Field
          label="Surname"
          active={next}
          value={
            next
              ? "Mehta".slice(
                  0,
                  Math.max(0, Math.floor((f - 3.8 * fps) / (fps * 0.14))),
                )
              : ""
          }
          tip="Enter your family name as shown in your documents."
        />
        <div
          style={{
            margin: "22px 34px",
            padding: "16px 20px",
            background: "#F0ECF9",
            borderRadius: 10,
            fontSize: 23,
            color: C.violetDark,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 20,
              background: C.violetDark,
            }}
          />
          {next
            ? "Typing focus moved to Surname"
            : "Auto guide is on · waiting for your pause"}
        </div>
      </Browser>
      <AnimatedCaptions
        speed={1.2}
        captions={[
          {
            text: "The page scrolls. The next box gets focus.",
            startMs: 300,
            endMs: 3100,
            timestampMs: null,
            confidence: null,
          },
          {
            text: "Just type. Pause. Continue.",
            startMs: 3100,
            endMs: 6000,
            timestampMs: null,
            confidence: null,
          },
        ]}
      />
      <div
        style={{
          position: "absolute",
          top: 1745,
          left: 85,
          fontSize: 23,
          color: C.muted,
        }}
      >
        Demo timing shortened · Auto guide can be paused
      </div>
    </Scene>
  );
};

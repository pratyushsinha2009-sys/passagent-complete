import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Scene,
  Title,
  Browser,
  PortalHeader,
  AnimatedCaptions,
  Button,
  C,
} from "../design";
export const Review = () => {
  const f = useCurrentFrame() * 1.2;
  const { fps } = useVideoConfig();
  const ready = f > 3.4 * fps;
  return (
    <Scene step="06 / REVIEW" duration={5}>
      <Title>
        Less confusion.
        <br />
        <span style={{ color: C.lime }}>More confidence.</span>
      </Title>
      <Browser height={850}>
        <PortalHeader
          section={ready ? "Review your details" : "Review this section"}
        />
        <div
          style={{
            margin: "18px 34px",
            padding: 25,
            border: "1px solid #E5DFEF",
            borderRadius: 14,
          }}
        >
          {[
            "Name · Asha Mehta",
            "Email · asha@example.com",
            "Employment · Student",
          ].map((label, i) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                fontSize: 29,
                padding: "23px 0",
                borderBottom: i < 2 ? "1px solid #EAE5F0" : "none",
                scale: spring({
                  frame: f - (0.4 + i * 0.35) * fps,
                  fps,
                  config: { damping: 22 },
                }),
              }}
            >
              <span style={{ color: "#6F9850", fontWeight: 700 }}>✓</span>
              {label}
            </div>
          ))}
        </div>
        <div
          style={{
            margin: "25px 34px",
            padding: 23,
            borderRadius: 12,
            background: "#F4F0FD",
            fontSize: 27,
            lineHeight: 1.3,
            color: "#68568E",
          }}
        >
          Check your answers carefully.
          <br />
          The coach guides. You make the final decisions.
        </div>
        <Button style={{ margin: "25px 34px" }}>
          {ready ? "You review. You submit." : "Continue on website →"}
        </Button>
      </Browser>
      <AnimatedCaptions
        speed={1.2}
        captions={[
          {
            text: "Guidance through the section. A clear review.",
            startMs: 300,
            endMs: 3000,
            timestampMs: null,
            confidence: null,
          },
          {
            text: "Final checks and submission stay with you.",
            startMs: 3000,
            endMs: 6000,
            timestampMs: null,
            confidence: null,
          },
        ]}
      />
    </Scene>
  );
};

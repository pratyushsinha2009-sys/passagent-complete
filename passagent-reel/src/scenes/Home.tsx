import {
  CanvasImage,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Scene,
  Title,
  Browser,
  AnimatedCaptions,
  C,
  clamp,
  Cursor,
} from "../design";
export const Home = () => {
  const f = useCurrentFrame() * 1.2;
  const { fps } = useVideoConfig();
  return (
    <Scene step="01 / START" duration={5}>
      <Title>
        Open the site.
        <br />
        <span style={{ color: C.violet }}>Find your way.</span>
      </Title>
      <Browser
        url="passportindia.gov.in/psp"
        badge="PUBLIC HOME PAGE + ENLARGED GUIDE"
        height={850}
      >
        <CanvasImage
          src={staticFile("passport-coach-home.png")}
          premountFor={fps}
          style={{ position: "absolute", width: 936, top: 0, left: 0 }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(transparent 25%,#14121Fdd 75%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 35,
            right: 35,
            top: 365,
            borderRadius: 18,
            padding: 30,
            background: "#FAF8FF",
            boxShadow: "0 15px 55px #0003",
            translate: `0 ${interpolate(f, [0.7 * fps, 1.3 * fps], [70, 0], clamp)}px`,
          }}
        >
          <div style={{ color: C.violetDark, fontSize: 29, fontWeight: 700 }}>
            ✦ Let’s start your passport application
          </div>
          <p style={{ fontSize: 30, lineHeight: 1.3, color: "#645C78" }}>
            First time here? Create an account.
            <br />
            Already registered? Sign in to continue.
          </p>
          <div style={{ display: "flex", gap: 15 }}>
            <div
              style={{
                padding: 18,
                borderRadius: 9,
                background: C.violetDark,
                color: "white",
                fontSize: 24,
              }}
            >
              I’m new — create account
            </div>
            <div
              style={{
                padding: 18,
                borderRadius: 9,
                border: "1px solid #CFC3EB",
                color: C.violetDark,
                fontSize: 24,
              }}
            >
              I already have an account
            </div>
          </div>
        </div>
        <Cursor
          x={interpolate(f, [2.6 * fps, 3.3 * fps], [720, 285], clamp)}
          y={interpolate(f, [2.6 * fps, 3.3 * fps], [680, 582], clamp)}
          click={f > 3.3 * fps && f < 3.6 * fps}
        />
      </Browser>
      <AnimatedCaptions
        speed={1.2}
        captions={[
          {
            text: "Guidance starts on the homepage.",
            startMs: 300,
            endMs: 2850,
            timestampMs: null,
            confidence: null,
          },
          {
            text: "New account or sign in? One clear choice.",
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

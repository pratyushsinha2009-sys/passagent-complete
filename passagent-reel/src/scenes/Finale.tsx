import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, Chrome, Mark, C, clamp } from "../design";
export const Finale = () => {
  const f = useCurrentFrame() * 1.25;
  const { fps } = useVideoConfig();
  return (
    <Scene light duration={4}>
      <div
        style={{
          position: "absolute",
          left: 82,
          top: 290,
          right: 82,
          fontSize: 104,
          fontWeight: 900,
          lineHeight: 1.01,
          letterSpacing: -6,
        }}
      >
        Your passport
        <br />
        journey.
        <br />
        <span style={{ color: C.violetDark }}>Made simpler.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 170,
          top: 810,
          width: 740,
          height: 390,
          borderRadius: 42,
          background: C.ink,
          color: C.paper,
          padding: 55,
          boxShadow: "0 35px 70px #24133822",
          rotate: `${interpolate(f, [0, 1.2 * fps], [-8, 0], clamp)}deg`,
          scale: spring({ frame: f - 0.2 * fps, fps, config: { damping: 20 } }),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Mark size={92} />
          <span style={{ fontSize: 67, fontWeight: 800, letterSpacing: -3 }}>
            PassAgent
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 25,
            marginTop: 65,
          }}
        >
          <Chrome size={75} />
          <span style={{ fontSize: 35, lineHeight: 1.2, color: C.lime }}>
            Your guide.
            <br />
            Inside Chrome.
          </span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          top: 1330,
          right: 82,
          fontSize: 67,
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: -3,
        }}
      >
        Available as a<br />
        <span style={{ color: C.violetDark }}>Chrome extension.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          top: 1580,
          right: 82,
          padding: "25px 35px",
          borderRadius: 15,
          background: C.violetDark,
          color: "white",
          fontSize: 36,
          fontWeight: 700,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        Start your guided journey <span>↗</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          top: 1718,
          right: 82,
          fontSize: 25,
          color: "#81748D",
        }}
      >
        Local installation via Chrome Developer mode.
        <br />
        An independent guide for Passport Seva.
      </div>
    </Scene>
  );
};

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, Scene, Mark } from "../design";
export const Hook = () => {
  const f = useCurrentFrame() * 1.3333333333333333;
  const { fps } = useVideoConfig();
  const reveal = f > 1.8 * fps;
  return (
    <Scene duration={3} light>
      <div
        style={{
          position: "absolute",
          top: 280,
          left: 82,
          right: 82,
          fontSize: 99,
          letterSpacing: -6,
          lineHeight: 1.01,
          fontWeight: 900,
        }}
      >
        {reveal ? (
          <>
            Meet your
            <br />
            passport
            <br />
            <span style={{ color: C.violetDark }}>guide.</span>
          </>
        ) : (
          <>
            Passport form.
            <br />
            Too many
            <br />
            <span style={{ color: C.violetDark }}>questions?</span>
          </>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 125,
          top: 820,
          width: 830,
          height: 450,
          rotate: reveal ? "0deg" : "-5deg",
          scale: spring({
            frame: f,
            fps,
            config: { damping: 18 },
          }),
          background: reveal ? C.ink : "#FFF",
          borderRadius: 32,
          padding: 55,
          boxShadow: "0 30px 70px #32244018",
          color: reveal ? C.paper : C.ink,
        }}
      >
        {reveal ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 25 }}>
              <Mark size={106} />
              <span
                style={{ fontSize: 72, fontWeight: 800, letterSpacing: -4 }}
              >
                PassAgent
              </span>
            </div>
            <div
              style={{
                fontSize: 42,
                lineHeight: 1.2,
                marginTop: 55,
                color: C.lime,
              }}
            >
              The next step.
              <br />
              Made clear.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 30, color: "#8C8496" }}>
              Employment type *
            </div>
            <div
              style={{
                marginTop: 20,
                padding: 20,
                border: "2px solid #D9D1E4",
                borderRadius: 10,
                fontSize: 34,
              }}
            >
              What should I choose? &nbsp;⌄
            </div>
            <div
              style={{
                fontSize: 55,
                color: C.violetDark,
                position: "absolute",
                right: 55,
                bottom: 40,
              }}
            >
              ?
            </div>
          </>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          right: 82,
          top: 1510,
          fontSize: 49,
          lineHeight: 1.25,
          fontWeight: 700,
          opacity: interpolate(f, [0.4 * fps, 0.8 * fps], [0, 1], clamp),
        }}
      >
        {reveal
          ? "Less guessing. More guidance."
          : "Filling a passport form shouldn’t feel this hard."}
      </div>
    </Scene>
  );
};

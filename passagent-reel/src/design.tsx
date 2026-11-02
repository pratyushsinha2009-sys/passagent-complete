import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Caption } from "@remotion/captions";
export const C = {
  ink: "#15131F",
  paper: "#F4F0E9",
  violet: "#B5A0FF",
  violetDark: "#7356CC",
  lime: "#D7F69A",
  muted: "#A7A1B4",
  peach: "#FFB99D",
};
export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const Mark: React.FC<{ size?: number; color?: string }> = ({
  size = 52,
  color = C.violet,
}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <rect
      x="5"
      y="5"
      width="45"
      height="54"
      rx="12"
      stroke={color}
      strokeWidth="3"
    />
    <circle cx="27" cy="27" r="11" stroke={color} strokeWidth="2.4" />
    <path
      d="M16 27h22M27 16c-8 8-8 14 0 22 8-8 8-14 0-22ZM18 47h14"
      stroke={color}
      strokeWidth="2.3"
    />
    <path
      d="m40 43 7 7L60 32"
      stroke={C.lime}
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const Chrome: React.FC<{ size?: number }> = ({ size = 125 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <clipPath id="chrome-circle">
        <circle cx="50" cy="50" r="46" />
      </clipPath>
    </defs>
    <g clipPath="url(#chrome-circle)">
      <path d="M0 0h100v39H50L26 80 0 36Z" fill="#EA4335" />
      <path d="M100 39v61H26l24-61Z" fill="#FBBC05" />
      <path d="M26 100H0V0l50 85Z" fill="#34A853" />
      <circle
        cx="50"
        cy="50"
        r="23"
        fill="#4285F4"
        stroke="white"
        strokeWidth="4"
      />
    </g>
  </svg>
);
export const Scene: React.FC<{
  children: React.ReactNode;
  step?: string;
  light?: boolean;
  duration: number;
}> = ({ children, step, light = false, duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      className="passagent-scene"
      style={{
        background: light ? C.paper : C.ink,
        color: light ? C.ink : C.paper,
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      <style>
        {".passagent-scene,.passagent-scene *{box-sizing:border-box}"}
      </style>
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          right: -420,
          top: 500,
          background: `radial-gradient(circle,${light ? "#D9CFFD" : "#322440"} 0%,transparent 66%)`,
          opacity: 0.65,
          translate: `${Math.sin(f / fps) * 25}px ${Math.cos(f / fps) * 25}px`,
        }}
      />
      <svg
        width="1080"
        height="1920"
        style={{ position: "absolute", opacity: 0.22 }}
      >
        <path
          d="M-140 1450C120 1900 1250 1100 1000 650S-100 1000 100 230"
          fill="none"
          stroke={light ? C.violetDark : C.violet}
          strokeWidth="2"
          strokeDasharray="5 14"
          strokeDashoffset={-f * 1.8}
        />
      </svg>
      <div
        style={{
          opacity: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 82,
            right: 82,
            top: 105,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Mark size={48} color={light ? C.violetDark : C.violet} />
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>
              PassAgent
            </span>
          </div>
          <span
            style={{
              fontSize: 22,
              letterSpacing: 3,
              color: light ? "#7B708E" : C.muted,
            }}
          >
            {step || "YOUR FORM. SIMPLIFIED."}
          </span>
        </div>
        {children}
        {step && (
          <div
            style={{
              position: "absolute",
              left: 82,
              right: 82,
              top: 1440,
              display: "flex",
              justifyContent: "center",
              gap: 18,
            }}
          >
            {["HIGHLIGHT", "EXPLAIN", "NEXT"].map((label, i) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 18px",
                  border: "1px solid #8F79BC55",
                  borderRadius: 30,
                  color:
                    i === Math.floor(f / (fps * 0.75)) % 3 ? C.lime : C.muted,
                  fontSize: 20,
                  letterSpacing: 2,
                  translate: `0 ${interpolate(f, [i * 3, i * 3 + 12], [14, 0], clamp)}px`,
                  opacity: interpolate(f, [i * 3, i * 3 + 10], [0, 1], clamp),
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 8,
                    background: "currentColor",
                  }}
                />
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
      <svg
        width="120"
        height="120"
        style={{
          position: "absolute",
          left: 20 + f * 1.2,
          top: 480 + Math.sin(f / fps) * 22,
          opacity: 0.22,
          rotate: "-15deg",
          pointerEvents: "none",
        }}
      >
        <path
          d="m14 60 75-22-24 51-10-24Z"
          fill="none"
          stroke={light ? C.violetDark : C.violet}
          strokeWidth="2"
        />
        <path
          d="m55 65 34-27"
          stroke={light ? C.violetDark : C.violet}
          strokeWidth="2"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          background: light ? C.violetDark : C.lime,
          translate: `${interpolate(f, [duration * fps - 5, duration * fps], [-12, 1080], { ...clamp, easing: ease })}px`,
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
export const Title: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 230,
        left: 82,
        right: 75,
        fontSize: 91,
        lineHeight: 1.03,
        fontWeight: 800,
        letterSpacing: -5,
        translate: `0 ${interpolate(f, [0, 0.45 * fps], [35, 0], { ...clamp, easing: ease })}px`,
        opacity: interpolate(f, [0, 0.2 * fps], [0.6, 1], clamp),
      }}
    >
      {children}
    </div>
  );
};
export const AnimatedCaptions: React.FC<{
  captions: Caption[];
  light?: boolean;
  speed?: number;
}> = ({ captions, light = false, speed = 1 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000 * speed;
  const current = captions.find((c) => ms >= c.startMs && ms < c.endMs);
  if (!current) return null;
  const age = ((ms - current.startMs) / 1000) * fps;
  return (
    <div
      style={{
        position: "absolute",
        left: 82,
        right: 82,
        top: 1540,
        fontSize: 53,
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: -1.8,
      }}
    >
      <span style={{ color: light ? C.violetDark : C.lime }}>✦ </span>
      {current.text.split(" ").map((word, i) => (
        <span
          key={`${current.startMs}-${i}`}
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            color:
              /simple|clear|choice|focus|type|pause|confirm|track|right/i.test(
                word,
              )
                ? light
                  ? C.violetDark
                  : C.lime
                : undefined,
            translate: `0 ${interpolate(age, [i * 0.025 * fps, (0.3 + i * 0.025) * fps], [20, 0], { ...clamp, easing: ease })}px`,
            opacity: interpolate(
              age,
              [i * 0.025 * fps, (0.15 + i * 0.025) * fps],
              [0, 1],
              clamp,
            ),
          }}
        >
          {word}{" "}
        </span>
      ))}
    </div>
  );
};
export const Browser: React.FC<{
  children: React.ReactNode;
  url?: string;
  badge?: string;
  height?: number;
}> = ({
  children,
  url = "passportindia.gov.in",
  badge = "RECREATED DEMO · EXAMPLE DETAILS",
  height = 825,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        top: 565,
        width: 936,
        height,
        borderRadius: 26,
        overflow: "hidden",
        background: "#FFF",
        boxShadow: "0 30px 100px #0004",
        border: "1px solid #FFFFFF35",
        translate: `0 ${interpolate(f, [0, 0.5 * fps], [35, 0], { ...clamp, easing: ease })}px`,
        opacity: interpolate(f, [0, 0.3 * fps], [0.75, 1], clamp),
        rotate: `${interpolate(f, [0, 0.6 * fps], [-1.4, 0], clamp)}deg`,
        scale: 1 + Math.sin((f / fps) * 0.8) * 0.003,
      }}
    >
      <div
        style={{
          height: 75,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 24px",
          background: "#EEEAF5",
          color: "#686079",
        }}
      >
        <i
          style={{
            width: 12,
            height: 12,
            borderRadius: 20,
            background: "#CDC4DD",
          }}
        />
        <i
          style={{
            width: 12,
            height: 12,
            borderRadius: 20,
            background: "#CDC4DD",
          }}
        />
        <i
          style={{
            width: 12,
            height: 12,
            borderRadius: 20,
            background: "#CDC4DD",
          }}
        />
        <div
          style={{
            marginLeft: 22,
            background: "white",
            borderRadius: 9,
            padding: "10px 20px",
            flex: 1,
            fontSize: 20,
            letterSpacing: 0.2,
          }}
        >
          ♧ &nbsp; {url}
        </div>
        <Chrome size={28} />
      </div>
      <div
        style={{
          position: "relative",
          height: height - 75,
          overflow: "hidden",
          color: C.ink,
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          padding: "7px 14px",
          borderTopLeftRadius: 8,
          background: "#F0ECF9",
          fontSize: 15,
          fontWeight: 700,
          color: "#786C90",
          letterSpacing: 1.3,
        }}
      >
        {badge}
      </div>
    </div>
  );
};
export const PortalHeader: React.FC<{ section?: string }> = ({
  section = "Applicant details",
}) => (
  <>
    <div
      style={{
        padding: "22px 32px",
        borderBottom: "1px solid #E9E4EF",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ color: "#6E63A8", fontWeight: 700, fontSize: 28 }}>
        Passport Seva
      </span>
      <span style={{ fontSize: 17, color: "#8B8398" }}>
        EXAMPLE DETAILS ONLY
      </span>
    </div>
    <div style={{ padding: "25px 34px 12px", fontSize: 34, fontWeight: 700 }}>
      {section}
    </div>
  </>
);
export const Field: React.FC<{
  label: string;
  value?: string;
  active?: boolean;
  error?: boolean;
  tip?: string;
}> = ({ label, value = "", active = false, error = false, tip }) => (
  <div style={{ margin: "19px 34px", position: "relative" }}>
    <div style={{ fontSize: 28, marginBottom: 9, color: "#6C637C" }}>
      {label} <span style={{ color: "#C68A80" }}>*</span>
    </div>
    <div
      style={{
        border: `${active ? 3 : 2}px solid ${error ? "#CB795D" : active ? C.violetDark : "#E4DFEA"}`,
        boxShadow: active
          ? `0 0 0 5px ${error ? "#F9E5DE" : "#ECE7FD"}`
          : "none",
        borderRadius: 10,
        padding: "17px 20px",
        height: 76,
        fontSize: 34,
        fontWeight: 500,
        background: active ? "#FEFDFF" : "#F8F6FB",
        color: C.ink,
        display: "flex",
        alignItems: "center",
        gap: 3,
      }}
    >
      {value}
      {active && !error && (
        <span
          style={{
            width: 2,
            height: 32,
            background: C.violetDark,
            display: "inline-block",
          }}
        />
      )}
    </div>
    {active && tip && (
      <div
        style={{
          display: "flex",
          gap: 17,
          marginTop: 12,
          background: error ? "#FFF0E9" : "#F2EEFD",
          border: `1px solid ${error ? "#EDC5B5" : "#D6C9FA"}`,
          borderRadius: 8,
          padding: "16px 18px",
          fontSize: 25,
          lineHeight: 1.35,
          color: error ? "#9A523C" : "#65518F",
        }}
      >
        <span>✦</span>
        <div>
          <b style={{ fontSize: 21 }}>Passport Coach</b>
          <div style={{ marginTop: 4 }}>{tip}</div>
        </div>
      </div>
    )}
  </div>
);
export const Button: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: C.violetDark,
      color: "#FFF",
      padding: "17px 24px",
      borderRadius: 10,
      fontSize: 27,
      fontWeight: 700,
      textAlign: "center",
      ...style,
    }}
  >
    {children}
  </div>
);
export const Cursor: React.FC<{ x: number; y: number; click?: boolean }> = ({
  x,
  y,
  click = false,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      pointerEvents: "none",
      filter: "drop-shadow(0 4px 4px #0003)",
    }}
  >
    <svg width="49" height="64" viewBox="0 0 49 64">
      <path
        d="M3 2v45l12-10 9 23 10-4-10-22 18-1Z"
        fill={C.ink}
        stroke="white"
        strokeWidth="3"
      />
    </svg>
    {click && (
      <div
        style={{
          position: "absolute",
          left: -18,
          top: -18,
          width: 46,
          height: 46,
          border: `3px solid ${C.violetDark}`,
          borderRadius: "50%",
        }}
      />
    )}
  </div>
);
export const Stamp: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        bottom: 440,
        padding: "17px 26px",
        border: `2px solid ${C.lime}`,
        borderRadius: 60,
        fontSize: 28,
        fontWeight: 700,
        color: C.lime,
        rotate: "-5deg",
        scale: spring({ frame: f - 0.5 * fps, fps, config: { damping: 15 } }),
      }}
    >
      {children}
    </div>
  );
};

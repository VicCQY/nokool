import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "180px",
          height: "180px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A0A",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            fontSize: "120px",
            fontWeight: 800,
            color: "#DC2626",
            lineHeight: 1,
          }}
        >
          K
        </span>
      </div>
    ),
    { ...size },
  );
}

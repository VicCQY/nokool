import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "192px",
          height: "192px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A0A",
          borderRadius: "32px",
          fontFamily: "sans-serif",
        }}
      >
        <span
          style={{
            fontSize: "130px",
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

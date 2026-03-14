import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A0A",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: "120px",
            fontWeight: 700,
            display: "flex",
          }}
        >
          <span style={{ color: "#FFFFFF" }}>No</span>
          <span style={{ color: "#DC2626" }}>Kool</span>
        </div>
        <div
          style={{
            fontSize: "32px",
            color: "#9CA3AF",
            marginTop: "16px",
          }}
        >
          {"We don't drink it, neither should you."}
        </div>
        <div
          style={{
            fontSize: "22px",
            color: "#6B7280",
            marginTop: "24px",
            maxWidth: "700px",
            textAlign: "center",
          }}
        >
          Track what politicians promise vs. what they deliver.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

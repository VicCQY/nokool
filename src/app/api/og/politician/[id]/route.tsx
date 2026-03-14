import { ImageResponse } from "next/og";

export const runtime = "edge";

const GRADE_COLORS: Record<string, string> = {
  A: "#22C55E",
  B: "#84CC16",
  C: "#EAB308",
  D: "#F97316",
  F: "#EF4444",
  "N/A": "#9CA3AF",
};

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/api/politicians/${params.id}/og-data`);

  if (!res.ok) {
    return new Response("Not found", { status: 404 });
  }

  const data = await res.json();
  const gradeColor = GRADE_COLORS[data.grade] || "#9CA3AF";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          backgroundColor: "#0A0A0A",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top section */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "64px",
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.1,
            }}
          >
            {data.name}
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#9CA3AF",
              marginTop: "12px",
            }}
          >
            {`${data.party} · ${data.country}`}
          </div>
        </div>

        {/* Middle - grade + stats */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "60px",
          }}
        >
          {/* Grade circle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "160px",
              height: "160px",
              borderRadius: "80px",
              border: `6px solid ${gradeColor}`,
              fontSize: "96px",
              fontWeight: 700,
              color: gradeColor,
            }}
          >
            {data.grade}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "48px", fontWeight: 700, color: "#FFFFFF" }}>
              {`${data.percentage}% Fulfillment`}
            </div>
            <div style={{ fontSize: "24px", color: "#9CA3AF" }}>
              {`${data.promiseCount} promises tracked`}
            </div>
            <div style={{ fontSize: "24px", color: data.koolAidColor }}>
              {`Kool-Aid Level: ${data.koolAidTier}`}
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            fontSize: "28px",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#FFFFFF" }}>No</span>
          <span style={{ color: "#DC2626" }}>Kool</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

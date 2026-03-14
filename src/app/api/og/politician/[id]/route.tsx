import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { calculateFulfillment } from "@/lib/grades";
import { getIssueWeights } from "@/lib/issue-weights-cache";
import { calculateKoolAidLevel } from "@/lib/koolaid";

export const runtime = "nodejs";

const GRADE_COLORS: Record<string, string> = {
  A: "#22C55E",
  B: "#84CC16",
  C: "#EAB308",
  D: "#F97316",
  F: "#EF4444",
  "N/A": "#9CA3AF",
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    select: {
      name: true,
      party: true,
      country: true,
      branch: true,
      chamber: true,
      termStart: true,
      termEnd: true,
      promises: {
        select: { status: true, category: true, weight: true, dateMade: true },
      },
    },
  });

  if (!politician) {
    return new Response("Not found", { status: 404 });
  }

  const weights = await getIssueWeights();
  const termInfo = {
    termStart: politician.termStart,
    termEnd: politician.termEnd,
    branch: politician.branch,
    chamber: politician.chamber,
  };
  const { percentage, grade } = calculateFulfillment(
    politician.promises,
    termInfo,
    weights,
  );
  const koolAid = calculateKoolAidLevel(percentage);
  const gradeColor = GRADE_COLORS[grade] || "#9CA3AF";

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
            {politician.name}
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#9CA3AF",
              marginTop: "12px",
            }}
          >
            {politician.party} &middot; {politician.country}
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
            {grade}
          </div>

          {/* Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "48px", fontWeight: 700, color: "#FFFFFF" }}>
              {percentage}% Fulfillment
            </div>
            <div style={{ fontSize: "24px", color: "#9CA3AF" }}>
              {politician.promises.length} promises tracked
            </div>
            <div style={{ fontSize: "24px", color: koolAid.color }}>
              Kool-Aid Level: {koolAid.tier}
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

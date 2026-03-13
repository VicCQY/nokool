import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { ExecutiveActionType } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const category = searchParams.get("category");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { politicianId: params.id };
  if (type) where.type = type;
  if (category) where.category = category;

  const actions = await prisma.executiveAction.findMany({
    where,
    orderBy: { dateIssued: "desc" },
  });

  return NextResponse.json(actions);
}

const VALID_TYPES: ExecutiveActionType[] = [
  "EXECUTIVE_ORDER",
  "PRESIDENTIAL_MEMORANDUM",
  "PROCLAMATION",
  "BILL_SIGNED",
  "BILL_VETOED",
  "POLICY_DIRECTIVE",
];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();

  if (!body.title || !body.type || !body.summary || !body.category || !body.dateIssued) {
    return NextResponse.json(
      { error: "title, type, summary, category, and dateIssued are required" },
      { status: 400 },
    );
  }

  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const action = await prisma.executiveAction.create({
    data: {
      politicianId: params.id,
      title: body.title,
      type: body.type,
      summary: body.summary,
      category: body.category,
      dateIssued: new Date(body.dateIssued),
      sourceUrl: body.sourceUrl || null,
      relatedPromises: body.relatedPromises || [],
    },
  });

  return NextResponse.json(action, { status: 201 });
}

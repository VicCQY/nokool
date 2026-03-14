import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PromiseForm } from "../PromiseForm";
import { BillLinksManager } from "./BillLinksManager";
import { ExecutiveActionLinksManager } from "./ExecutiveActionLinksManager";

export const dynamic = "force-dynamic";

export default async function EditPromisePage({
  params,
}: {
  params: { id: string; promiseId: string };
}) {
  const [promise, politician] = await Promise.all([
    prisma.promise.findUnique({
      where: { id: params.promiseId },
      include: {
        billLinks: {
          include: {
            bill: {
              select: {
                id: true,
                title: true,
                billNumber: true,
                category: true,
                votes: {
                  where: { politicianId: params.id },
                  select: { position: true },
                },
              },
            },
          },
        },
        actionLinks: {
          include: {
            action: {
              select: {
                id: true,
                title: true,
                type: true,
                category: true,
                dateIssued: true,
              },
            },
          },
          orderBy: { createdAt: "desc" as const },
        },
      },
    }),
    prisma.politician.findUnique({
      where: { id: params.id },
      select: { branch: true },
    }),
  ]);

  if (!promise) notFound();

  const isExecutive = politician?.branch === "executive";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Promise</h1>
      <PromiseForm
        politicianId={params.id}
        promise={{
          id: promise.id,
          title: promise.title,
          description: promise.description,
          category: promise.category,
          dateMade: promise.dateMade.toISOString().split("T")[0],
          sourceUrl: promise.sourceUrl ?? "",
          status: promise.status,
          weight: promise.weight,
          expectedMonths: promise.expectedMonths,
        }}
      />
      {isExecutive ? (
        <ExecutiveActionLinksManager
          promiseId={promise.id}
          politicianId={params.id}
          initialLinks={promise.actionLinks.map((link) => ({
            id: link.id,
            alignment: link.alignment,
            action: {
              id: link.action.id,
              title: link.action.title,
              type: link.action.type,
              category: link.action.category,
              dateIssued: link.action.dateIssued.toISOString(),
            },
          }))}
        />
      ) : (
        <BillLinksManager
          promiseId={promise.id}
          politicianId={params.id}
          initialLinks={promise.billLinks.map((link) => ({
            id: link.id,
            alignment: link.alignment,
            relevance: link.relevance,
            bill: {
              id: link.bill.id,
              title: link.bill.title,
              billNumber: link.bill.billNumber,
              category: link.bill.category,
            },
            votePosition: link.bill.votes.length > 0 ? link.bill.votes[0].position : null,
          }))}
        />
      )}
    </div>
  );
}

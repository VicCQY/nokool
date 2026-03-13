import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ActionForm } from "../ActionForm";

export const dynamic = "force-dynamic";

export default async function EditActionPage({
  params,
}: {
  params: { id: string; actionId: string };
}) {
  const [politician, action] = await Promise.all([
    prisma.politician.findUnique({
      where: { id: params.id },
      include: { promises: { select: { id: true, title: true }, orderBy: { title: "asc" } } },
    }),
    prisma.executiveAction.findUnique({ where: { id: params.actionId } }),
  ]);

  if (!politician || !action) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Edit Executive Action
      </h1>
      <ActionForm
        politicianId={politician.id}
        action={{
          id: action.id,
          title: action.title,
          type: action.type,
          summary: action.summary,
          category: action.category,
          dateIssued: action.dateIssued.toISOString().split("T")[0],
          sourceUrl: action.sourceUrl ?? "",
          relatedPromises: action.relatedPromises,
        }}
        promises={politician.promises}
      />
    </div>
  );
}

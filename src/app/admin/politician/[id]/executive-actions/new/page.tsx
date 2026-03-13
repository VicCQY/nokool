import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ActionForm } from "../ActionForm";

export const dynamic = "force-dynamic";

export default async function NewActionPage({
  params,
}: {
  params: { id: string };
}) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: { promises: { select: { id: true, title: true }, orderBy: { title: "asc" } } },
  });

  if (!politician) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Add Executive Action for {politician.name}
      </h1>
      <ActionForm
        politicianId={politician.id}
        promises={politician.promises}
      />
    </div>
  );
}

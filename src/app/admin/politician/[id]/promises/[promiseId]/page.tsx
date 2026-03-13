import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PromiseForm } from "../PromiseForm";

export const dynamic = "force-dynamic";

export default async function EditPromisePage({
  params,
}: {
  params: { id: string; promiseId: string };
}) {
  const promise = await prisma.promise.findUnique({
    where: { id: params.promiseId },
  });

  if (!promise) notFound();

  return (
    <div>
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
        }}
      />
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PoliticianForm } from "../PoliticianForm";

export const dynamic = "force-dynamic";

export default async function EditPoliticianPage({
  params,
}: {
  params: { id: string };
}) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
  });

  if (!politician) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Edit Politician
      </h1>
      <PoliticianForm
        politician={{
          id: politician.id,
          name: politician.name,
          country: politician.country,
          party: politician.party,
          photoUrl: politician.photoUrl ?? "",
          termStart: politician.termStart.toISOString().split("T")[0],
          termEnd: politician.termEnd
            ? politician.termEnd.toISOString().split("T")[0]
            : "",
        }}
      />
    </div>
  );
}

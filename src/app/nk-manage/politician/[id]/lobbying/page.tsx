import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LobbyingManager } from "./LobbyingManager";

export const dynamic = "force-dynamic";

export default async function ManageLobbyingPage({ params }: { params: { id: string } }) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: {
      lobbyingRecords: { orderBy: { amount: "desc" } },
    },
  });

  if (!politician) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lobbying: {politician.name}</h1>
          <Link href="/nk-manage" className="text-sm text-blue-600 hover:underline">Back to Admin</Link>
        </div>
      </div>

      <LobbyingManager
        politicianId={politician.id}
        records={politician.lobbyingRecords.map((l) => ({
          id: l.id,
          lobbyistName: l.lobbyistName,
          clientName: l.clientName,
          clientIndustry: l.clientIndustry,
          issue: l.issue,
          amount: l.amount,
          year: l.year,
          sourceUrl: l.sourceUrl,
        }))}
      />
    </div>
  );
}

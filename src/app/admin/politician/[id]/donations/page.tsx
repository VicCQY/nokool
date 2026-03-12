import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DonationManager } from "./DonationManager";

export const dynamic = "force-dynamic";

export default async function ManageDonationsPage({ params }: { params: { id: string } }) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: {
      donations: {
        include: { donor: true },
        orderBy: { amount: "desc" },
      },
    },
  });

  if (!politician) notFound();

  const donors = await prisma.donor.findMany({
    where: { country: politician.country },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donations: {politician.name}</h1>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">Back to Admin</Link>
        </div>
      </div>

      <DonationManager
        politicianId={politician.id}
        donations={politician.donations.map((d) => ({
          id: d.id,
          amount: d.amount,
          date: d.date.toISOString(),
          electionCycle: d.electionCycle,
          sourceUrl: d.sourceUrl,
          donor: { id: d.donor.id, name: d.donor.name },
        }))}
        donors={donors.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}

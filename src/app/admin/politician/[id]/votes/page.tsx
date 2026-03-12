import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VoteManager } from "./VoteManager";

export const dynamic = "force-dynamic";

export default async function ManageVotesPage({
  params,
}: {
  params: { id: string };
}) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: {
      votes: {
        include: { bill: true },
        orderBy: { bill: { dateVoted: "desc" } },
      },
    },
  });

  if (!politician) notFound();

  // Get all bills for this country that the politician could vote on
  const allBills = await prisma.bill.findMany({
    where: { country: politician.country },
    orderBy: { dateVoted: "desc" },
  });

  const votedBillIds = new Set(politician.votes.map((v) => v.billId));
  const unvotedBills = allBills.filter((b) => !votedBillIds.has(b.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Votes: {politician.name}
          </h1>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>
      </div>

      <VoteManager
        politicianId={politician.id}
        existingVotes={politician.votes.map((v) => ({
          id: v.id,
          position: v.position,
          bill: {
            id: v.bill.id,
            title: v.bill.title,
            billNumber: v.bill.billNumber,
          },
        }))}
        unvotedBills={unvotedBills.map((b) => ({
          id: b.id,
          title: b.title,
          billNumber: b.billNumber,
        }))}
      />
    </div>
  );
}

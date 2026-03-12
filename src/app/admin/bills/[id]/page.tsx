import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BillForm } from "../BillForm";

export const dynamic = "force-dynamic";

export default async function EditBillPage({
  params,
}: {
  params: { id: string };
}) {
  const bill = await prisma.bill.findUnique({ where: { id: params.id } });
  if (!bill) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Bill</h1>
        <Link
          href="/admin/bills"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Bills
        </Link>
      </div>
      <BillForm
        bill={{
          id: bill.id,
          title: bill.title,
          summary: bill.summary,
          billNumber: bill.billNumber,
          category: bill.category,
          country: bill.country,
          session: bill.session,
          dateVoted: bill.dateVoted.toISOString(),
          sourceUrl: bill.sourceUrl,
        }}
      />
    </div>
  );
}

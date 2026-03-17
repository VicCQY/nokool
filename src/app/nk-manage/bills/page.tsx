import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";
import { BillDeleteButton } from "./BillDeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminBillsPage() {
  const bills = await prisma.bill.findMany({
    include: { _count: { select: { votes: true } } },
    orderBy: { dateVoted: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <Link
          href="/nk-manage/bills/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add Bill
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Bill
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Country
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Votes
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">
                  {bill.title}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                  {bill.billNumber}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {bill.category}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {COUNTRIES[bill.country as keyof typeof COUNTRIES]?.flag ?? bill.country}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {bill._count.votes}
                </td>
                <td className="px-6 py-4 text-right text-sm space-x-2">
                  <Link
                    href={`/nk-manage/bills/${bill.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <BillDeleteButton id={bill.id} title={bill.title} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bills.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No bills yet. Add one to get started.
          </p>
        )}
      </div>
    </div>
  );
}

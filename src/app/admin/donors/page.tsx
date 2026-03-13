import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";
import { DonorDeleteButton } from "./DonorDeleteButton";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  CORPORATION: "Corporation",
  PAC: "PAC",
  SUPER_PAC: "Super PAC",
  INDIVIDUAL: "Individual",
  UNION: "Union",
  NONPROFIT: "Nonprofit",
  TRADE_ASSOCIATION: "Trade Assoc.",
};

export default async function AdminDonorsPage() {
  const donors = await prisma.donor.findMany({
    include: { _count: { select: { donations: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Donors</h1>
        <Link
          href="/admin/donors/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add Donor
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Industry</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Donations</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {donors.map((donor) => (
              <tr key={donor.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{donor.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{TYPE_LABELS[donor.type] || donor.type}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{donor.industry}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{COUNTRIES[donor.country as keyof typeof COUNTRIES]?.flag ?? donor.country}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{donor._count.donations}</td>
                <td className="px-6 py-4 text-right text-sm space-x-2">
                  <Link href={`/admin/donors/${donor.id}`} className="text-blue-600 hover:underline">Edit</Link>
                  <DonorDeleteButton id={donor.id} name={donor.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {donors.length === 0 && (
          <p className="text-center text-gray-500 py-8">No donors yet. Add one to get started.</p>
        )}
      </div>
    </div>
  );
}

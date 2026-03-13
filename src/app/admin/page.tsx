import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";
import { DeleteButton } from "./DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const politicians = await prisma.politician.findMany({
    include: { _count: { select: { promises: true, executiveActions: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <Link
          href="/admin/politician/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add Politician
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Country
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Party
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Promises
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {politicians.map((pol) => (
              <tr key={pol.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {pol.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {COUNTRIES[pol.country as keyof typeof COUNTRIES]?.flag ?? ""} {COUNTRIES[pol.country as keyof typeof COUNTRIES]?.name ?? pol.country}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {pol.party}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {pol._count.promises}
                </td>
                <td className="px-6 py-4 text-right text-sm space-x-2">
                  <Link
                    href={`/admin/politician/${pol.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/politician/${pol.id}/promises`}
                    className="text-green-600 hover:underline"
                  >
                    Promises
                  </Link>
                  {pol.branch === "executive" ? (
                    <Link
                      href={`/admin/politician/${pol.id}/executive-actions`}
                      className="text-purple-600 hover:underline"
                    >
                      Actions
                    </Link>
                  ) : (
                    <Link
                      href={`/admin/politician/${pol.id}/votes`}
                      className="text-purple-600 hover:underline"
                    >
                      Votes
                    </Link>
                  )}
                  <Link
                    href={`/admin/politician/${pol.id}/donations`}
                    className="text-amber-600 hover:underline"
                  >
                    Donations
                  </Link>
                  <Link
                    href={`/admin/politician/${pol.id}/lobbying`}
                    className="text-teal-600 hover:underline"
                  >
                    Lobbying
                  </Link>
                  <DeleteButton id={pol.id} name={pol.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {politicians.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No politicians yet. Add one to get started.
          </p>
        )}
      </div>
    </div>
  );
}

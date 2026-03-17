import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { COUNTRIES } from "@/lib/countries";
import { DeleteButton } from "./DeleteButton";

export const dynamic = "force-dynamic";

const EVENT_TYPE_LABELS: Record<string, string> = {
  status_change: "Status Change",
  bill_vote: "Bill Vote",
  executive_action: "Executive Action",
  news: "News",
  promise_made: "Promise Made",
  research_note: "Research Note",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
};

export default async function AdminPage() {
  const [politicians, recentEvents] = await Promise.all([
    prisma.politician.findMany({
      include: { _count: { select: { promises: true, executiveActions: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.promiseEvent.findMany({
      include: {
        promise: {
          select: {
            title: true,
            politician: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <Link
          href="/nk-manage/politician/new"
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
                    href={`/nk-manage/politician/${pol.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/nk-manage/politician/${pol.id}/promises`}
                    className="text-green-600 hover:underline"
                  >
                    Promises
                  </Link>
                  {pol.branch === "executive" ? (
                    <Link
                      href={`/nk-manage/politician/${pol.id}/executive-actions`}
                      className="text-purple-600 hover:underline"
                    >
                      Actions
                    </Link>
                  ) : (
                    <Link
                      href={`/nk-manage/politician/${pol.id}/votes`}
                      className="text-purple-600 hover:underline"
                    >
                      Votes
                    </Link>
                  )}
                  <Link
                    href={`/nk-manage/politician/${pol.id}/donations`}
                    className="text-amber-600 hover:underline"
                  >
                    Donations
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

      {/* Recent Activity */}
      {recentEvents.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
            <Link
              href="/nk-manage/review"
              className="text-sm text-blue-600 hover:underline"
            >
              Review Queue &rarr;
            </Link>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Promise</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Politician</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {EVENT_TYPE_LABELS[e.eventType] || e.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-900 max-w-[200px] truncate">{e.promise.title}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{e.promise.politician.name}</td>
                    <td className="px-4 py-2.5">
                      {e.eventType === "status_change" && e.oldStatus && e.newStatus ? (
                        <span className="text-xs font-mono">
                          {e.oldStatus} → {e.newStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600">{e.createdBy}</span>
                        {e.confidence && (
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_COLORS[e.confidence] || "bg-gray-100 text-gray-600"}`}>
                            {e.confidence}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {e.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

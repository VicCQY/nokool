import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ActionDeleteButton } from "./ActionDeleteButton";

const TYPE_LABELS: Record<string, string> = {
  EXECUTIVE_ORDER: "Executive Order",
  PRESIDENTIAL_MEMORANDUM: "Memorandum",
  PROCLAMATION: "Proclamation",
  BILL_SIGNED: "Bill Signed",
  BILL_VETOED: "Bill Vetoed",
  POLICY_DIRECTIVE: "Policy Directive",
};

export const dynamic = "force-dynamic";

export default async function ManageActionsPage({
  params,
}: {
  params: { id: string };
}) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: { executiveActions: { orderBy: { dateIssued: "desc" } } },
  });

  if (!politician) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Executive Actions: {politician.name}
          </h1>
          <Link
            href="/admin"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>
        <Link
          href={`/admin/politician/${politician.id}/executive-actions/new`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add Action
        </Link>
      </div>

      <div className="space-y-3">
        {politician.executiveActions.map((action) => (
          <div
            key={action.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {action.title}
                </span>
                <span className="text-xs text-gray-400 rounded bg-gray-50 px-1.5 py-0.5">
                  {TYPE_LABELS[action.type] || action.type}
                </span>
                <span className="text-xs text-gray-400 rounded bg-gray-50 px-1.5 py-0.5">
                  {action.category}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {action.dateIssued.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Link
                href={`/admin/politician/${politician.id}/executive-actions/${action.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit
              </Link>
              <ActionDeleteButton
                politicianId={politician.id}
                actionId={action.id}
              />
            </div>
          </div>
        ))}
        {politician.executiveActions.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No executive actions yet. Add one to start tracking.
          </p>
        )}
      </div>
    </div>
  );
}

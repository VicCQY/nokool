import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { PromiseDeleteButton } from "./PromiseDeleteButton";

export const dynamic = "force-dynamic";

export default async function ManagePromisesPage({
  params,
}: {
  params: { id: string };
}) {
  const politician = await prisma.politician.findUnique({
    where: { id: params.id },
    include: { promises: { orderBy: { dateMade: "desc" } } },
  });

  if (!politician) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Promises: {politician.name}
          </h1>
          <Link
            href="/nk-manage"
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Admin
          </Link>
        </div>
        <Link
          href={`/nk-manage/politician/${politician.id}/promises/new`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add Promise
        </Link>
      </div>

      <div className="space-y-3">
        {politician.promises.map((promise) => (
          <div
            key={promise.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {promise.title}
                </span>
                <StatusBadge status={promise.status} />
                <span className="text-xs text-gray-400 rounded bg-gray-50 px-1.5 py-0.5">
                  {promise.category}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Link
                href={`/nk-manage/politician/${politician.id}/promises/${promise.id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit
              </Link>
              <PromiseDeleteButton
                politicianId={politician.id}
                promiseId={promise.id}
              />
            </div>
          </div>
        ))}
        {politician.promises.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No promises yet. Add one to start tracking.
          </p>
        )}
      </div>
    </div>
  );
}

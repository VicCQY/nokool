"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VotePosition } from "@prisma/client";

interface ExistingVote {
  id: string;
  position: VotePosition;
  bill: { id: string; title: string; billNumber: string };
}

interface UnvotedBill {
  id: string;
  title: string;
  billNumber: string;
}

const POSITIONS: VotePosition[] = ["YEA", "NAY", "ABSTAIN", "ABSENT"];

const POSITION_COLORS: Record<VotePosition, string> = {
  YEA: "bg-green-50 text-green-700 border-green-200",
  NAY: "bg-red-50 text-red-700 border-red-200",
  ABSTAIN: "bg-amber-50 text-amber-700 border-amber-200",
  ABSENT: "bg-gray-50 text-gray-500 border-gray-200",
};

export function VoteManager({
  politicianId,
  existingVotes,
  unvotedBills,
}: {
  politicianId: string;
  existingVotes: ExistingVote[];
  unvotedBills: UnvotedBill[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  async function updateVote(voteId: string, position: VotePosition) {
    setSaving(voteId);
    await fetch(`/api/politicians/${politicianId}/votes/${voteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position }),
    });
    setSaving(null);
    router.refresh();
  }

  async function deleteVote(voteId: string) {
    if (!confirm("Remove this vote?")) return;
    setSaving(voteId);
    await fetch(`/api/politicians/${politicianId}/votes/${voteId}`, {
      method: "DELETE",
    });
    setSaving(null);
    router.refresh();
  }

  async function createVote(billId: string, position: VotePosition) {
    setSaving(billId);
    await fetch(`/api/politicians/${politicianId}/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billId, position }),
    });
    setSaving(null);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Existing votes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Current Votes ({existingVotes.length})
        </h2>
        <div className="space-y-3">
          {existingVotes.map((vote) => (
            <div
              key={vote.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm gap-3"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 truncate block">
                  {vote.bill.title}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {vote.bill.billNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={vote.position}
                  onChange={(e) =>
                    updateVote(vote.id, e.target.value as VotePosition)
                  }
                  disabled={saving === vote.id}
                  className={`rounded-md border px-2 py-1 text-sm font-medium ${POSITION_COLORS[vote.position]}`}
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => deleteVote(vote.id)}
                  disabled={saving === vote.id}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {existingVotes.length === 0 && (
            <p className="text-gray-500 text-sm">No votes recorded yet.</p>
          )}
        </div>
      </div>

      {/* Unvoted bills */}
      {unvotedBills.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Quick-Assign Votes ({unvotedBills.length} bills without votes)
          </h2>
          <div className="space-y-3">
            {unvotedBills.map((bill) => (
              <div
                key={bill.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 gap-3"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-700 truncate block">
                    {bill.title}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {bill.billNumber}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {POSITIONS.map((position) => (
                    <button
                      key={position}
                      onClick={() => createVote(bill.id, position)}
                      disabled={saving === bill.id}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50 ${POSITION_COLORS[position]}`}
                    >
                      {position}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

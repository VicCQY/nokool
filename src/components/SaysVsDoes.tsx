"use client";

import { PromiseStatus, VotePosition } from "@prisma/client";
import { VotePositionBadge } from "./VotePositionBadge";
import { StatusBadge } from "./StatusBadge";

interface PromiseData {
  id: string;
  title: string;
  category: string;
  status: PromiseStatus;
}

interface VoteWithBill {
  id: string;
  position: VotePosition;
  bill: {
    id: string;
    title: string;
    billNumber: string;
    category: string;
    dateVoted: string;
  };
}

function getAlignment(
  position: VotePosition,
): "aligned" | "contradiction" | "neutral" {
  if (position === "YEA") return "aligned";
  if (position === "NAY") return "contradiction";
  return "neutral";
}

export function SaysVsDoes({
  promises,
  votes,
}: {
  promises: PromiseData[];
  votes: VoteWithBill[];
}) {
  // Group promises by category
  const categories = Array.from(new Set(promises.map((p) => p.category)));

  // Group votes by bill category
  const votesByCategory: Record<string, VoteWithBill[]> = {};
  for (const vote of votes) {
    const cat = vote.bill.category;
    if (!votesByCategory[cat]) votesByCategory[cat] = [];
    votesByCategory[cat].push(vote);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#1A1A1A] mb-1">
          Says vs Does
        </h2>
        <p className="text-sm text-[#4A4A4A] mb-5">
          How do their promises line up with their actual votes? We match
          promises and bills by category to spot patterns.
        </p>

        <div className="space-y-6">
          {categories.map((category) => {
            const categoryPromises = promises.filter(
              (p) => p.category === category,
            );
            const categoryVotes = votesByCategory[category] || [];

            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-[#4A4A4A]">
                    {category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {categoryPromises.length} promise
                    {categoryPromises.length !== 1 ? "s" : ""},{" "}
                    {categoryVotes.length} vote
                    {categoryVotes.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {categoryPromises.map((promise) => (
                  <div
                    key={promise.id}
                    className="mb-4 last:mb-0 rounded-lg border border-gray-100 bg-gray-50/50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-[#1A1A1A]">
                        &ldquo;{promise.title}&rdquo;
                      </span>
                      <StatusBadge status={promise.status} />
                    </div>

                    {categoryVotes.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No voting data in this area yet
                      </p>
                    ) : (
                      <div className="space-y-2 ml-3 border-l-2 border-gray-200 pl-3">
                        {categoryVotes.map((vote) => {
                          const alignment = getAlignment(vote.position);
                          return (
                            <div
                              key={vote.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <VotePositionBadge position={vote.position} />
                                <span className="text-sm text-[#1A1A1A] truncate">
                                  {vote.bill.title}
                                </span>
                                <span className="text-xs text-gray-400 hidden sm:inline">
                                  {vote.bill.billNumber}
                                </span>
                              </div>
                              <div>
                                {alignment === "aligned" && (
                                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                                    Aligned
                                  </span>
                                )}
                                {alignment === "contradiction" && (
                                  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                    Contradiction
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

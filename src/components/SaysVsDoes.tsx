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

interface ActionData {
  id: string;
  title: string;
  type: string;
  category: string;
  dateIssued: string;
  relatedPromises: string[];
}

function getAlignment(
  position: VotePosition,
): "aligned" | "contradiction" | "neutral" {
  if (position === "YEA") return "aligned";
  if (position === "NAY") return "contradiction";
  return "neutral";
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  EXECUTIVE_ORDER: "Executive Order",
  PRESIDENTIAL_MEMORANDUM: "Memorandum",
  PROCLAMATION: "Proclamation",
  BILL_SIGNED: "Bill Signed",
  BILL_VETOED: "Bill Vetoed",
  POLICY_DIRECTIVE: "Policy Directive",
};

export function SaysVsDoes({
  promises,
  votes,
  actions,
  branch,
}: {
  promises: PromiseData[];
  votes?: VoteWithBill[];
  actions?: ActionData[];
  branch?: string;
}) {
  const isExecutive = branch === "executive";
  const categories = Array.from(new Set(promises.map((p) => p.category)));

  // Legislative: group votes by category
  const votesByCategory: Record<string, VoteWithBill[]> = {};
  if (votes) {
    for (const vote of votes) {
      const cat = vote.bill.category;
      if (!votesByCategory[cat]) votesByCategory[cat] = [];
      votesByCategory[cat].push(vote);
    }
  }

  // Executive: group actions by category + build direct linkage map
  const actionsByCategory: Record<string, ActionData[]> = {};
  const actionsByPromiseId: Record<string, ActionData[]> = {};
  if (actions) {
    for (const action of actions) {
      const cat = action.category;
      if (!actionsByCategory[cat]) actionsByCategory[cat] = [];
      actionsByCategory[cat].push(action);
      // Direct links via relatedPromises
      for (const pid of action.relatedPromises) {
        if (!actionsByPromiseId[pid]) actionsByPromiseId[pid] = [];
        actionsByPromiseId[pid].push(action);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#1A1A1A] mb-1">
          Says vs Does
        </h2>
        <p className="text-sm text-[#4A4A4A] mb-5">
          {isExecutive
            ? "How do their promises line up with their executive actions? We match promises and actions by category and direct linkage."
            : "How do their promises line up with their actual votes? We match promises and bills by category to spot patterns."}
        </p>

        <div className="space-y-6">
          {categories.map((category) => {
            const categoryPromises = promises.filter(
              (p) => p.category === category,
            );

            if (isExecutive) {
              const categoryActions = actionsByCategory[category] || [];
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-[#4A4A4A]">
                      {category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {categoryPromises.length} promise
                      {categoryPromises.length !== 1 ? "s" : ""},{" "}
                      {categoryActions.length} action
                      {categoryActions.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {categoryPromises.map((promise) => {
                    // Directly linked actions take priority
                    const directActions = actionsByPromiseId[promise.id] || [];
                    // Then category-matched ones (excluding already shown direct ones)
                    const directIds = new Set(directActions.map((a) => a.id));
                    const categoryMatched = categoryActions.filter(
                      (a) => !directIds.has(a.id),
                    );
                    const allRelevant = [...directActions, ...categoryMatched];

                    return (
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

                        {allRelevant.length === 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                              No Executive Action
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2 ml-3 border-l-2 border-gray-200 pl-3">
                            {allRelevant.map((action) => {
                              const isDirect = directIds.has(action.id);
                              return (
                                <div
                                  key={action.id}
                                  className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                      {ACTION_TYPE_LABELS[action.type] || action.type}
                                    </span>
                                    <span className="text-sm text-[#1A1A1A] truncate">
                                      {action.title}
                                    </span>
                                  </div>
                                  <div>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      isDirect
                                        ? "bg-green-50 text-green-700"
                                        : "bg-green-50 text-green-700"
                                    }`}>
                                      Action Taken
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Legislative branch
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

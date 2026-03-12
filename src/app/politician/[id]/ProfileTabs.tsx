"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { key: "promises", label: "Promises" },
  { key: "votes", label: "Voting Record" },
  { key: "saysvsdoes", label: "Says vs Does" },
  { key: "money", label: "Money Trail" },
] as const;

export function ProfileTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "promises";

  function setTab(tab: string) {
    const params = new URLSearchParams();
    if (tab !== "promises") {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
            currentTab === key
              ? "bg-[#0D0D0D] text-white shadow-sm"
              : "bg-white text-[#4A4A4A] hover:bg-gray-100 border border-gray-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

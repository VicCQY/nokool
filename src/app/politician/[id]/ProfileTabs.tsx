"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Tab {
  key: string;
  label: string;
  shortLabel: string;
}

const LEGISLATIVE_TABS: Tab[] = [
  { key: "saysvsdoes", label: "Says vs Does", shortLabel: "Says/Does" },
  { key: "promises", label: "Promises", shortLabel: "Promises" },
  { key: "votes", label: "Voting Record", shortLabel: "Votes" },
  { key: "money", label: "Money Trail", shortLabel: "Money" },
];

const EXECUTIVE_TABS: Tab[] = [
  { key: "saysvsdoes", label: "Says vs Does", shortLabel: "Says/Does" },
  { key: "promises", label: "Promises", shortLabel: "Promises" },
  { key: "actions", label: "Executive Actions", shortLabel: "Actions" },
  { key: "money", label: "Money Trail", shortLabel: "Money" },
];

export function ProfileTabs({ branch }: { branch: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? "saysvsdoes";
  const tabs = branch === "executive" ? EXECUTIVE_TABS : LEGISLATIVE_TABS;

  function setTab(tab: string) {
    const params = new URLSearchParams();
    if (tab !== "saysvsdoes") {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
      {tabs.map(({ key, label, shortLabel }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
            currentTab === key
              ? "bg-[#0D0D0D] text-white shadow-sm"
              : "bg-white text-[#4A4A4A] hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </button>
      ))}
    </div>
  );
}

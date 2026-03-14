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
  { key: "news", label: "News", shortLabel: "News" },
];

const EXECUTIVE_TABS: Tab[] = [
  { key: "saysvsdoes", label: "Says vs Does", shortLabel: "Says/Does" },
  { key: "promises", label: "Promises", shortLabel: "Promises" },
  { key: "actions", label: "Executive Actions", shortLabel: "Actions" },
  { key: "money", label: "Money Trail", shortLabel: "Money" },
  { key: "news", label: "News", shortLabel: "News" },
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
    <div className="relative">
      {/* Fade edges for scroll indication on mobile */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white to-transparent z-10 sm:hidden" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white to-transparent z-10 sm:hidden" />

      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide px-1">
        {tabs.map(({ key, label, shortLabel }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-full px-5 py-2.5 min-h-[44px] text-sm font-medium transition-all duration-200 ${
              currentTab === key
                ? "bg-[#0D0D0D] text-white shadow-sm"
                : "text-slate hover:bg-cool-gray"
            }`}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

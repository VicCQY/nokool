"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") ?? "list";

  function setView(view: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setView("list")}
        className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
          currentView !== "timeline"
            ? "bg-[#0D0D0D] text-white"
            : "text-[#4A4A4A] hover:bg-gray-50"
        }`}
      >
        List
      </button>
      <button
        onClick={() => setView("timeline")}
        className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
          currentView === "timeline"
            ? "bg-[#0D0D0D] text-white"
            : "text-[#4A4A4A] hover:bg-gray-50"
        }`}
      >
        Timeline
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show admin nav on login page
  if (pathname === "/nk-manage/login") return null;

  async function handleLogout() {
    await fetch("/api/nk-manage/logout", { method: "POST" });
    router.push("/nk-manage/login");
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Left: brand */}
          <div className="flex items-center gap-6">
            <Link
              href="/nk-manage"
              className="text-base font-bold text-gray-900"
            >
              NoKool <span className="text-gray-400 font-normal text-sm">Admin</span>
            </Link>

            {/* Nav links */}
            <div className="hidden sm:flex items-center gap-1">
              <Link
                href="/nk-manage"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/nk-manage"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/nk-manage/politician/new"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/nk-manage/politician/new"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Add Politician
              </Link>
              <Link
                href="/nk-manage/bills"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith("/nk-manage/bills")
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Bills
              </Link>
              <Link
                href="/nk-manage/donors"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith("/nk-manage/donors")
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Donors
              </Link>
              <Link
                href="/nk-manage/import"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/nk-manage/import"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Import
              </Link>
              <Link
                href="/nk-manage/sync"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/nk-manage/sync"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Sync
              </Link>
              <Link
                href="/nk-manage/research"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/nk-manage/research"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                AI Research
              </Link>
              <Link
                href="/nk-manage/review"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/nk-manage/review"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Review
              </Link>
              <Link
                href="/nk-manage/settings"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/nk-manage/settings"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Settings
              </Link>
            </div>
          </div>

          {/* Right: back + logout */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              &larr; Back to site
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

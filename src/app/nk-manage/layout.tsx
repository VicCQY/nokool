"use client";

import { usePathname } from "next/navigation";
import { AdminNav } from "./AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Login page renders its own full-screen layout
  if (pathname === "/nk-manage/login") {
    return <>{children}</>;
  }

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

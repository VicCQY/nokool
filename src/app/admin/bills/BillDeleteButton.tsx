"use client";

import { useRouter } from "next/navigation";

export function BillDeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete "${title}"? This will also delete all associated votes.`)) return;
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      className="text-red-600 hover:underline"
    >
      Delete
    </button>
  );
}

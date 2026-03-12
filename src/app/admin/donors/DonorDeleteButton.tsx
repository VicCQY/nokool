"use client";

import { useRouter } from "next/navigation";

export function DonorDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete donor "${name}"? This will also delete all their donations.`)) return;
    await fetch(`/api/donors/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button onClick={handleDelete} className="text-red-600 hover:underline">
      Delete
    </button>
  );
}

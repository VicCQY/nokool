"use client";

import { useRouter } from "next/navigation";

export function PromiseDeleteButton({
  politicianId,
  promiseId,
}: {
  politicianId: string;
  promiseId: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this promise?")) return;

    const res = await fetch(
      `/api/politicians/${politicianId}/promises/${promiseId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <button onClick={handleDelete} className="text-sm text-red-600 hover:underline">
      Delete
    </button>
  );
}

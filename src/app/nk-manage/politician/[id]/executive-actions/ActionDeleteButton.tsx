"use client";

import { useRouter } from "next/navigation";

export function ActionDeleteButton({
  politicianId,
  actionId,
}: {
  politicianId: string;
  actionId: string;
}) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this executive action?")) return;
    await fetch(
      `/api/politicians/${politicianId}/executive-actions/${actionId}`,
      { method: "DELETE" },
    );
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      className="text-sm text-red-600 hover:underline"
    >
      Delete
    </button>
  );
}

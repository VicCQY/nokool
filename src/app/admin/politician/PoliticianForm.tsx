"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";

interface PoliticianData {
  id?: string;
  name: string;
  country: string;
  party: string;
  photoUrl: string;
  termStart: string;
  termEnd: string;
  inOfficeSince: string;
}

export function PoliticianForm({
  politician,
}: {
  politician?: PoliticianData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<PoliticianData>(
    politician ?? {
      name: "",
      country: "US",
      party: "",
      photoUrl: "",
      termStart: "",
      termEnd: "",
      inOfficeSince: "",
    },
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const url = politician?.id
      ? `/api/politicians/${politician.id}`
      : "/api/politicians";
    const method = politician?.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setLoading(false);
      alert("Failed to save politician");
    }
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-4 rounded-lg bg-white p-6 border border-gray-200 shadow-sm"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          required
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Country
        </label>
        <select
          className={inputClass}
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
        >
          {Object.entries(COUNTRIES).map(([code, info]) => (
            <option key={code} value={code}>
              {info.flag} {info.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Party
        </label>
        <input
          required
          className={inputClass}
          value={form.party}
          onChange={(e) => setForm({ ...form, party: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Photo URL
        </label>
        <input
          type="url"
          className={inputClass}
          value={form.photoUrl}
          onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Term Start
          </label>
          <input
            required
            type="date"
            className={inputClass}
            value={form.termStart}
            onChange={(e) => setForm({ ...form, termStart: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Term End
          </label>
          <input
            type="date"
            className={inputClass}
            value={form.termEnd}
            onChange={(e) => setForm({ ...form, termEnd: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          In Office Since
        </label>
        <input
          type="date"
          className={inputClass}
          value={form.inOfficeSince}
          onChange={(e) => setForm({ ...form, inOfficeSince: e.target.value })}
        />
        <p className="mt-1 text-xs text-gray-500">
          When they first entered this office (for display).
        </p>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Saving..." : politician?.id ? "Update" : "Create"}
      </button>
    </form>
  );
}

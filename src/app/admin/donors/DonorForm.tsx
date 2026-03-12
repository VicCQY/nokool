"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";

const DONOR_TYPES = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "CORPORATION", label: "Corporation" },
  { value: "PAC", label: "PAC" },
  { value: "SUPER_PAC", label: "Super PAC" },
  { value: "UNION", label: "Union" },
  { value: "NONPROFIT", label: "Nonprofit" },
  { value: "TRADE_ASSOCIATION", label: "Trade Association" },
];

const INDUSTRIES = [
  "Oil & Gas", "Finance", "Technology", "Pharmaceutical", "Defense",
  "Healthcare", "Education", "Real Estate", "Political", "Entertainment",
  "Transportation", "Engineering", "Labour", "Manufacturing",
];

interface DonorFormProps {
  donor?: {
    id: string;
    name: string;
    type: string;
    industry: string;
    country: string;
  };
}

export function DonorForm({ donor }: DonorFormProps) {
  const router = useRouter();
  const isEdit = !!donor;

  const [form, setForm] = useState({
    name: donor?.name ?? "",
    type: donor?.type ?? "INDIVIDUAL",
    industry: donor?.industry ?? "",
    country: donor?.country ?? "US",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = isEdit ? `/api/donors/${donor.id}` : "/api/donors";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push("/admin/donors");
      router.refresh();
    } else {
      alert("Failed to save donor");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text" required value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            required value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            {DONOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
          <select
            required value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
        <select
          required value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          {Object.entries(COUNTRIES).map(([code, info]) => (
            <option key={code} value={code}>{info.flag} {info.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update Donor" : "Create Donor"}
        </button>
        <button type="button" onClick={() => router.push("/admin/donors")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

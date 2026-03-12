import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DonorForm } from "../DonorForm";

export const dynamic = "force-dynamic";

export default async function EditDonorPage({ params }: { params: { id: string } }) {
  const donor = await prisma.donor.findUnique({ where: { id: params.id } });
  if (!donor) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Donor</h1>
        <Link href="/admin/donors" className="text-sm text-blue-600 hover:underline">Back to Donors</Link>
      </div>
      <DonorForm donor={{
        id: donor.id,
        name: donor.name,
        type: donor.type,
        industry: donor.industry,
        country: donor.country,
      }} />
    </div>
  );
}

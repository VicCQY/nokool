import Link from "next/link";
import { DonorForm } from "../DonorForm";

export default function NewDonorPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Donor</h1>
        <Link href="/admin/donors" className="text-sm text-blue-600 hover:underline">Back to Donors</Link>
      </div>
      <DonorForm />
    </div>
  );
}

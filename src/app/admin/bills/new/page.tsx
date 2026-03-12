import Link from "next/link";
import { BillForm } from "../BillForm";

export default function NewBillPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Bill</h1>
        <Link
          href="/admin/bills"
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Bills
        </Link>
      </div>
      <BillForm />
    </div>
  );
}

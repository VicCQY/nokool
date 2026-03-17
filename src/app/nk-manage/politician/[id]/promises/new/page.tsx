import { PromiseForm } from "../PromiseForm";

export default function NewPromisePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Promise</h1>
      <PromiseForm politicianId={params.id} />
    </div>
  );
}

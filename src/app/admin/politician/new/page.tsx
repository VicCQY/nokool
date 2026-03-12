import { PoliticianForm } from "../PoliticianForm";

export default function NewPoliticianPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Add Politician
      </h1>
      <PoliticianForm />
    </div>
  );
}

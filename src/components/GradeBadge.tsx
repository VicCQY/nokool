const GRADE_COLORS: Record<string, string> = {
  A: "bg-[#22C55E]",
  B: "bg-[#3B82F6]",
  C: "bg-[#F59E0B]",
  D: "bg-[#F97316]",
  F: "bg-[#EF4444]",
  "N/A": "bg-gray-400",
};

export function GradeBadge({
  grade,
  percentage,
}: {
  grade: string;
  percentage: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-xl shadow-sm ${GRADE_COLORS[grade] ?? "bg-gray-400"}`}
      >
        {grade}
      </span>
      <span className="text-sm font-medium text-[#4A4A4A]">{percentage}%</span>
    </div>
  );
}

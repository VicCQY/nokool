const GRADE_COLORS: Record<string, string> = {
  A: "bg-grade-A",
  B: "bg-grade-B",
  C: "bg-grade-C",
  D: "bg-grade-D",
  F: "bg-grade-F",
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
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-white font-data font-bold text-xl shadow-sm ${GRADE_COLORS[grade] ?? "bg-gray-400"}`}
      >
        {grade}
      </span>
      <span className="text-sm font-data font-medium text-slate">{percentage}%</span>
    </div>
  );
}

import { PromiseStatus } from "@prisma/client";

interface PromiseRecord {
  status: PromiseStatus;
}

export function calculateFulfillment(promises: PromiseRecord[]) {
  if (promises.length === 0) return { percentage: 0, grade: "N/A" };

  const fulfilled = promises.filter((p) => p.status === "FULFILLED").length;
  const partial = promises.filter((p) => p.status === "PARTIAL").length;

  const score = ((fulfilled + partial * 0.5) / promises.length) * 100;
  const percentage = Math.round(score);

  let grade: string;
  if (percentage >= 90) grade = "A";
  else if (percentage >= 80) grade = "B";
  else if (percentage >= 70) grade = "C";
  else if (percentage >= 60) grade = "D";
  else grade = "F";

  return { percentage, grade };
}

/**
 * Fallback: auto-determine election years from politician type and start date.
 * Only used when fecElectionYears is not available.
 * Capped at the last completed election year (before November of even years).
 */
export function getElectionYears(
  branch: string,
  chamber: string | null,
  startDate: Date
): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  let maxYear = currentYear % 2 === 0 ? currentYear : currentYear - 1;
  if (currentYear % 2 === 0 && now.getMonth() < 11) maxYear = currentYear - 2;
  const startYear = startDate.getFullYear();

  if (branch === "executive") {
    const years: number[] = [];
    let y = Math.ceil(startYear / 4) * 4;
    if (y < startYear) y += 4;
    const electionBeforeStart = y - 4;
    if (electionBeforeStart >= 2000) years.push(electionBeforeStart);
    for (; y <= maxYear; y += 4) {
      years.push(y);
    }
    return years;
  }

  if (chamber === "senate") {
    let firstElection = startYear;
    if (firstElection % 2 !== 0) firstElection -= 1;
    if (startYear % 2 !== 0) firstElection = startYear - 1;

    const years: number[] = [];
    for (let y = firstElection; y <= maxYear; y += 6) {
      if (y >= 2000) years.push(y);
    }
    if (years.length === 0) years.push(firstElection);
    return years;
  }

  // House: every 2 years
  let firstElection = startYear;
  if (firstElection % 2 !== 0) firstElection -= 1;

  const years: number[] = [];
  for (let y = firstElection; y <= maxYear; y += 2) {
    if (y >= 2000) years.push(y);
  }
  if (years.length === 0) years.push(firstElection);
  return years;
}

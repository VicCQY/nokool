/**
 * Auto-determine election years for a politician based on their type and start date.
 * Returns only recent cycles (capped at last completed election year, limited count).
 */
export function getElectionYears(
  branch: string,
  chamber: string | null,
  startDate: Date
): number[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  // Cap at the last even year whose election has already happened (November)
  // If we're in an even year but before December, that election may not have full FEC data yet
  let maxYear = currentYear % 2 === 0 ? currentYear : currentYear - 1;
  if (currentYear % 2 === 0 && now.getMonth() < 11) maxYear = currentYear - 2;
  const startYear = startDate.getFullYear();

  if (branch === "executive") {
    // Presidential elections every 4 years — return last 2
    const years: number[] = [];
    let y = Math.ceil(startYear / 4) * 4;
    if (y < startYear) y += 4;
    const electionBeforeStart = y - 4;
    if (electionBeforeStart >= 2000) years.push(electionBeforeStart);
    for (; y <= maxYear; y += 4) {
      years.push(y);
    }
    return years.slice(-2);
  }

  if (chamber === "senate") {
    // Senators elected every 6 years — return last 2
    let firstElection = startYear;
    if (firstElection % 2 !== 0) firstElection -= 1;
    if (startYear % 2 !== 0) firstElection = startYear - 1;

    const years: number[] = [];
    for (let y = firstElection; y <= maxYear; y += 6) {
      if (y >= 2000) years.push(y);
    }
    if (years.length === 0) years.push(firstElection);
    return years.slice(-2);
  }

  // House: every 2 years — return last 3
  let firstElection = startYear;
  if (firstElection % 2 !== 0) firstElection -= 1;

  const years: number[] = [];
  for (let y = firstElection; y <= maxYear; y += 2) {
    if (y >= 2000) years.push(y);
  }
  if (years.length === 0) years.push(firstElection);
  return years.slice(-3);
}

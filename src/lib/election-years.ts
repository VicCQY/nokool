/**
 * Auto-determine election years for a politician based on their type and start date.
 */
export function getElectionYears(
  branch: string,
  chamber: string | null,
  startDate: Date
): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = startDate.getFullYear();

  if (branch === "executive") {
    // Presidential elections every 4 years
    const years: number[] = [];
    // Find the first presidential election year >= startYear
    let y = Math.ceil(startYear / 4) * 4;
    if (y < startYear) y += 4;
    // Also include the election that got them into office (could be startYear - 1 or startYear)
    const electionBeforeStart = y - 4;
    if (electionBeforeStart >= 2000) years.push(electionBeforeStart);
    for (; y <= currentYear + 2; y += 4) {
      years.push(y);
    }
    return years;
  }

  if (chamber === "senate") {
    // Senators elected every 6 years
    // Determine their first election year: typically the even year before they took office
    let firstElection = startYear;
    if (firstElection % 2 !== 0) firstElection -= 1;
    // Senate terms start Jan of odd year, so election was the prior even year
    if (startYear % 2 !== 0) firstElection = startYear - 1;

    const years: number[] = [];
    for (let y = firstElection; y <= currentYear + 2; y += 6) {
      if (y >= 2000) years.push(y);
    }
    // If empty (edge case), include at least the most recent election
    if (years.length === 0) years.push(firstElection);
    return years;
  }

  // House: every 2 years
  let firstElection = startYear;
  if (firstElection % 2 !== 0) firstElection -= 1;

  const years: number[] = [];
  for (let y = firstElection; y <= currentYear + 2; y += 2) {
    if (y >= 2000) years.push(y);
  }
  if (years.length === 0) years.push(firstElection);
  return years;
}

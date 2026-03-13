import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ActionSeed {
  title: string;
  type: "EXECUTIVE_ORDER" | "PRESIDENTIAL_MEMORANDUM" | "PROCLAMATION" | "BILL_SIGNED" | "BILL_VETOED" | "POLICY_DIRECTIVE";
  summary: string;
  category: string;
  dateIssued: string;
  sourceUrl: string;
  relatedPromiseTitles: string[];
}

const TRUMP_ACTIONS: ActionSeed[] = [
  {
    title: "Declaring a National Emergency at the Southern Border",
    type: "EXECUTIVE_ORDER",
    summary: "Declares a national emergency at the southern border of the United States, directing the armed forces and Department of Homeland Security to address illegal immigration and drug trafficking.",
    category: "Immigration",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/declaring-a-national-emergency-at-the-southern-border-of-the-united-states/",
    relatedPromiseTitles: ["Largest deportation operation in history", "Militarize the US-Mexico border", "Reinstate Remain in Mexico policy"],
  },
  {
    title: "Protecting the Meaning and Value of American Citizenship",
    type: "EXECUTIVE_ORDER",
    summary: "Directs federal agencies to deny birthright citizenship to children born to parents who are neither citizens nor lawful permanent residents, reinterpreting the 14th Amendment.",
    category: "Immigration",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/protecting-the-meaning-and-value-of-american-citizenship/",
    relatedPromiseTitles: ["End birthright citizenship"],
  },
  {
    title: "Unleashing American Energy",
    type: "EXECUTIVE_ORDER",
    summary: "Declares a national energy emergency, reverses Biden-era restrictions on oil, gas, and coal production, rescinds the electric vehicle mandate, and opens federal lands for energy exploration.",
    category: "Economy",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/unleashing-american-energy/",
    relatedPromiseTitles: ["Drill baby drill — expand oil and gas production"],
  },
  {
    title: "Withdrawal from the Paris Climate Agreement",
    type: "EXECUTIVE_ORDER",
    summary: "Formally begins the process of withdrawing the United States from the Paris Agreement on climate change for the second time.",
    category: "Environment",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/putting-america-first-in-international-environmental-agreements/",
    relatedPromiseTitles: [],
  },
  {
    title: "Securing Our Borders",
    type: "EXECUTIVE_ORDER",
    summary: "Directs the construction of a border wall, suspends the entry of illegal immigrants, reinstates the Remain in Mexico policy, and ends catch-and-release.",
    category: "Immigration",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/securing-our-borders/",
    relatedPromiseTitles: ["Reinstate Remain in Mexico policy", "Militarize the US-Mexico border", "Largest deportation operation in history"],
  },
  {
    title: "Pardons for January 6 Defendants",
    type: "PROCLAMATION",
    summary: "Grants full, complete, and unconditional pardons to approximately 1,500 defendants charged in connection with events at the U.S. Capitol on January 6, 2021.",
    category: "Justice",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/granting-pardons-and-commutation-of-sentences-for-certain-offenses-relating-to-the-events-at-or-near-the-united-states-capitol-on-january-6-2021/",
    relatedPromiseTitles: ["Full pardons for January 6 defendants"],
  },
  {
    title: "Defending Women from Gender Ideology Extremism",
    type: "EXECUTIVE_ORDER",
    summary: "Defines sex as binary and immutable under federal law, directs agencies to enforce sex-based distinctions in prisons, shelters, and sports.",
    category: "Other",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/defending-women-from-gender-ideology-extremism-and-restoring-biological-truth-to-the-federal-government/",
    relatedPromiseTitles: ["Ban transgender athletes from women's sports"],
  },
  {
    title: "Imposing 25% Tariffs on Canada and Mexico",
    type: "EXECUTIVE_ORDER",
    summary: "Imposes 25% tariffs on all imports from Canada and Mexico, citing national emergency over fentanyl trafficking and illegal immigration.",
    category: "Economy",
    dateIssued: "2025-02-01",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/imposing-duties-to-address-the-flow-of-illicit-drugs-across-our-northern-border/",
    relatedPromiseTitles: ["10-20% universal tariff on all imports"],
  },
  {
    title: "Establishing DOGE — Department of Government Efficiency",
    type: "EXECUTIVE_ORDER",
    summary: "Establishes the Department of Government Efficiency (DOGE) led by Elon Musk to identify and eliminate wasteful government spending, reduce the federal workforce, and modernize IT systems.",
    category: "Economy",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/establishing-and-implementing-the-presidents-department-of-government-efficiency/",
    relatedPromiseTitles: [],
  },
  {
    title: "Restoring the Death Penalty",
    type: "EXECUTIVE_ORDER",
    summary: "Directs the Attorney General to pursue the death penalty for federal crimes including murder of law enforcement officers and capital drug trafficking offenses.",
    category: "Justice",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/restoring-the-death-penalty-and-protecting-public-safety/",
    relatedPromiseTitles: ["Expand use of the death penalty"],
  },
  {
    title: "Protecting the United States from Foreign Terrorists",
    type: "EXECUTIVE_ORDER",
    summary: "Suspends the U.S. Refugee Admissions Program and restricts entry from several countries deemed to pose national security risks.",
    category: "Immigration",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/protecting-the-united-states-from-foreign-terrorists-and-other-national-security-and-public-safety-threats/",
    relatedPromiseTitles: [],
  },
  {
    title: "Protecting Americans from TikTok",
    type: "EXECUTIVE_ORDER",
    summary: "Delays enforcement of the TikTok ban for 75 days to allow time for a deal that would preserve national security while keeping TikTok available to Americans.",
    category: "Technology",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/application-of-protecting-americans-from-foreign-adversary-controlled-applications-act-to-tiktok/",
    relatedPromiseTitles: ["Save TikTok"],
  },
  {
    title: "Reforming the Federal Hiring Process and Restoring Merit",
    type: "EXECUTIVE_ORDER",
    summary: "Overhauls federal hiring practices by reinstating Schedule F, making it easier to fire federal employees and replacing them with political appointees aligned with the administration.",
    category: "Other",
    dateIssued: "2025-01-20",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/reforming-the-federal-hiring-process-and-restoring-merit-to-government-service/",
    relatedPromiseTitles: [],
  },
  {
    title: "Additional Tariffs on China (10%)",
    type: "EXECUTIVE_ORDER",
    summary: "Imposes an additional 10% tariff on all Chinese imports, citing China's failure to curb fentanyl production and trafficking to the United States.",
    category: "Economy",
    dateIssued: "2025-02-04",
    sourceUrl: "https://www.whitehouse.gov/presidential-actions/imposing-duties-to-address-the-synthetic-opioid-supply-chain-in-the-peoples-republic-of-china/",
    relatedPromiseTitles: ["10-20% universal tariff on all imports"],
  },
];

async function main() {
  console.log("=== Seeding Trump executive actions ===");

  const trump = await prisma.politician.findFirst({
    where: { name: { contains: "Trump" } },
    include: { promises: { select: { id: true, title: true } } },
  });

  if (!trump) {
    console.log("Trump not found in database. Skipping.");
    await prisma.$disconnect();
    return;
  }

  // Build title-to-id mapping for relatedPromises
  const promiseMap = new Map(trump.promises.map((p) => [p.title, p.id]));

  // Check existing actions to avoid duplicates
  const existing = await prisma.executiveAction.findMany({
    where: { politicianId: trump.id },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((a) => a.title));

  let created = 0;
  for (const action of TRUMP_ACTIONS) {
    if (existingTitles.has(action.title)) {
      console.log(`  [skip] "${action.title}" already exists`);
      continue;
    }

    const relatedPromises = action.relatedPromiseTitles
      .map((t) => promiseMap.get(t))
      .filter((id): id is string => !!id);

    const unmatched = action.relatedPromiseTitles.filter((t) => !promiseMap.has(t));
    if (unmatched.length > 0) {
      console.log(`  [warn] Unmatched promises for "${action.title}": ${unmatched.join(", ")}`);
    }

    await prisma.executiveAction.create({
      data: {
        politicianId: trump.id,
        title: action.title,
        type: action.type,
        summary: action.summary,
        category: action.category,
        dateIssued: new Date(action.dateIssued),
        sourceUrl: action.sourceUrl,
        relatedPromises,
      },
    });

    console.log(`  [created] "${action.title}" (${action.type}, ${relatedPromises.length} linked promises)`);
    created++;
  }

  console.log(`\nDone. Created ${created} executive actions for ${trump.name}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

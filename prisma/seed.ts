import { PrismaClient, Country, PromiseStatus, VotePosition, DonorType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.lobbyingRecord.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.donor.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.promiseStatusChange.deleteMany();
  await prisma.promise.deleteMany();
  await prisma.politician.deleteMany();

  // US - Joe Biden
  const biden = await prisma.politician.create({
    data: {
      name: "Joe Biden",
      country: Country.US,
      party: "Democratic Party",
      photoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Joe_Biden_presidential_portrait.jpg/220px-Joe_Biden_presidential_portrait.jpg",
      termStart: new Date("2021-01-20"),
      termEnd: new Date("2025-01-20"),
    },
  });

  const bidenPromises = await Promise.all([
    prisma.promise.create({
      data: {
        politicianId: biden.id,
        title: "Administer 100 million vaccine doses in first 100 days",
        description:
          "Biden pledged to administer 100 million COVID-19 vaccine doses within his first 100 days in office.",
        category: "Healthcare",
        dateMade: new Date("2020-12-08"),
        status: PromiseStatus.KEPT,
        sourceUrl: "https://www.bbc.com/news/world-us-canada-56173953",
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: biden.id,
        title: "Rejoin the Paris Climate Agreement",
        description:
          "Committed to rejoining the Paris Climate Agreement on day one of his presidency.",
        category: "Environment",
        dateMade: new Date("2020-07-14"),
        status: PromiseStatus.KEPT,
        sourceUrl:
          "https://www.whitehouse.gov/briefing-room/statements-releases/2021/01/20/paris-climate-agreement/",
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: biden.id,
        title: "$15 federal minimum wage",
        description:
          "Promised to raise the federal minimum wage to $15 per hour.",
        category: "Economy",
        dateMade: new Date("2020-03-15"),
        status: PromiseStatus.BROKE,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: biden.id,
        title: "Cancel $10,000 in student debt per borrower",
        description:
          "Pledged to cancel $10,000 of student loan debt for each borrower.",
        category: "Education",
        dateMade: new Date("2020-03-15"),
        status: PromiseStatus.FIGHTING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: biden.id,
        title: "Comprehensive immigration reform",
        description:
          "Promised to send an immigration reform bill to Congress in first 100 days.",
        category: "Immigration",
        dateMade: new Date("2020-07-20"),
        status: PromiseStatus.FIGHTING,
      },
    }),
  ]);

  // Biden status changes
  const [bidenVax, bidenParis, bidenWage, bidenDebt, bidenImmigration] =
    bidenPromises;

  await prisma.promiseStatusChange.createMany({
    data: [
      // Vaccine: quick progression NOT_STARTED -> IN_PROGRESS -> FULFILLED
      { promiseId: bidenVax.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-01-20") },
      { promiseId: bidenVax.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2021-01-21"), note: "Vaccination rollout begins" },
      { promiseId: bidenVax.id, oldStatus: "FIGHTING", newStatus: "KEPT", changedAt: new Date("2021-03-19"), note: "100 million doses administered ahead of schedule" },

      // Paris: immediate fulfillment
      { promiseId: bidenParis.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-01-20") },
      { promiseId: bidenParis.id, oldStatus: "NOTHING", newStatus: "KEPT", changedAt: new Date("2021-01-20"), note: "Executive order signed on day one" },

      // $15 minimum wage: stalled and eventually broken
      { promiseId: bidenWage.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-01-20") },
      { promiseId: bidenWage.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2021-02-15"), note: "Included in COVID relief proposal" },
      { promiseId: bidenWage.id, oldStatus: "FIGHTING", newStatus: "BROKE", changedAt: new Date("2022-12-01"), note: "Provision removed from reconciliation bill, no path forward" },

      // Student debt: slow partial
      { promiseId: bidenDebt.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-01-20") },
      { promiseId: bidenDebt.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2022-08-24"), note: "Announced broad student debt relief plan" },
      { promiseId: bidenDebt.id, oldStatus: "FIGHTING", newStatus: "FIGHTING", changedAt: new Date("2023-06-30"), note: "Supreme Court struck down broad plan; alternative SAVE plan launched" },

      // Immigration: still in progress
      { promiseId: bidenImmigration.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-01-20") },
      { promiseId: bidenImmigration.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2021-02-18"), note: "Immigration reform bill sent to Congress" },
    ],
  });

  // Canada - Justin Trudeau
  const trudeau = await prisma.politician.create({
    data: {
      name: "Justin Trudeau",
      country: Country.CA,
      party: "Liberal Party",
      photoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Justin_Trudeau_in_Lima%2C_Peru_-_2018_%2841507995581%29_%28cropped%29.jpg/220px-Justin_Trudeau_in_Lima%2C_Peru_-_2018_%2841507995581%29_%28cropped%29.jpg",
      termStart: new Date("2021-11-22"),
      termEnd: new Date("2025-03-14"),
    },
  });

  const trudeauPromises = await Promise.all([
    prisma.promise.create({
      data: {
        politicianId: trudeau.id,
        title: "Plant 2 billion trees by 2030",
        description:
          "Committed to planting 2 billion trees over 10 years as part of climate plan.",
        category: "Environment",
        dateMade: new Date("2021-08-15"),
        status: PromiseStatus.FIGHTING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: trudeau.id,
        title: "National childcare program at $10/day",
        description:
          "Promised to create a national $10-a-day childcare program.",
        category: "Social Policy",
        dateMade: new Date("2021-08-15"),
        status: PromiseStatus.KEPT,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: trudeau.id,
        title: "Ban assault-style firearms",
        description:
          "Pledged to implement a mandatory buyback program for assault-style firearms.",
        category: "Social Policy",
        dateMade: new Date("2021-08-20"),
        status: PromiseStatus.FIGHTING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: trudeau.id,
        title: "Build 1.4 million new homes",
        description:
          "Promised to build, preserve, or repair 1.4 million homes over 4 years.",
        category: "Infrastructure",
        dateMade: new Date("2021-09-01"),
        status: PromiseStatus.NOTHING,
      },
    }),
  ]);

  const [trudeauTrees, trudeauChildcare, trudeauGuns, trudeauHomes] =
    trudeauPromises;

  await prisma.promiseStatusChange.createMany({
    data: [
      // Trees: slow start
      { promiseId: trudeauTrees.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-11-22") },
      { promiseId: trudeauTrees.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2022-06-01"), note: "Program launched with initial funding" },

      // Childcare: gradual fulfillment
      { promiseId: trudeauChildcare.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-11-22") },
      { promiseId: trudeauChildcare.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2022-03-01"), note: "Provincial agreements signed" },
      { promiseId: trudeauChildcare.id, oldStatus: "FIGHTING", newStatus: "KEPT", changedAt: new Date("2024-04-01"), note: "All provinces at or near $10/day target" },

      // Firearms: partial
      { promiseId: trudeauGuns.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-11-22") },
      { promiseId: trudeauGuns.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2022-05-30"), note: "Handgun freeze introduced via Bill C-21" },
      { promiseId: trudeauGuns.id, oldStatus: "FIGHTING", newStatus: "FIGHTING", changedAt: new Date("2023-12-15"), note: "Bill passed but mandatory buyback not yet implemented" },

      // Homes: no action (NOT_STARTED stays)
      { promiseId: trudeauHomes.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2021-11-22") },
    ],
  });

  // UK - Keir Starmer
  const starmer = await prisma.politician.create({
    data: {
      name: "Keir Starmer",
      country: Country.UK,
      party: "Labour Party",
      photoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Official_portrait_of_Keir_Starmer_crop_2.jpg/220px-Official_portrait_of_Keir_Starmer_crop_2.jpg",
      termStart: new Date("2024-07-05"),
    },
  });

  const starmerPromises = await Promise.all([
    prisma.promise.create({
      data: {
        politicianId: starmer.id,
        title: "Set up Great British Energy",
        description:
          "Create a publicly owned clean energy company to cut bills and boost energy security.",
        category: "Environment",
        dateMade: new Date("2024-06-13"),
        status: PromiseStatus.FIGHTING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: starmer.id,
        title: "Recruit 6,500 new teachers",
        description:
          "Fund 6,500 new expert teachers in key subjects across England.",
        category: "Education",
        dateMade: new Date("2024-06-13"),
        status: PromiseStatus.NOTHING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: starmer.id,
        title: "Cut NHS waiting times",
        description:
          "Provide 40,000 more appointments per week to cut NHS waiting lists.",
        category: "Healthcare",
        dateMade: new Date("2024-06-13"),
        status: PromiseStatus.FIGHTING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: starmer.id,
        title: "Launch new Border Security Command",
        description:
          "Create a new Border Security, Asylum and Immigration Command with counter-terror powers.",
        category: "Immigration",
        dateMade: new Date("2024-06-13"),
        status: PromiseStatus.KEPT,
      },
    }),
  ]);

  const [starmerEnergy, starmerTeachers, starmerNHS, starmerBorder] =
    starmerPromises;

  await prisma.promiseStatusChange.createMany({
    data: [
      // Energy: fairly quick start
      { promiseId: starmerEnergy.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2024-07-05") },
      { promiseId: starmerEnergy.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2024-07-25"), note: "Great British Energy bill introduced to Parliament" },

      // Teachers: no action yet
      { promiseId: starmerTeachers.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2024-07-05") },

      // NHS: started
      { promiseId: starmerNHS.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2024-07-05") },
      { promiseId: starmerNHS.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2024-09-01"), note: "Additional NHS funding announced in autumn budget" },

      // Border: quick fulfillment
      { promiseId: starmerBorder.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2024-07-05") },
      { promiseId: starmerBorder.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2024-07-08"), note: "Border Security Command established" },
      { promiseId: starmerBorder.id, oldStatus: "FIGHTING", newStatus: "KEPT", changedAt: new Date("2024-09-15"), note: "Fully operational with counter-terror powers" },
    ],
  });

  // US - Donald Trump (second term)
  const trump = await prisma.politician.create({
    data: {
      name: "Donald Trump",
      country: Country.US,
      party: "Republican Party",
      photoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Donald_Trump_official_portrait.jpg/220px-Donald_Trump_official_portrait.jpg",
      termStart: new Date("2025-01-20"),
    },
  });

  const trumpPromises = await Promise.all([
    prisma.promise.create({
      data: {
        politicianId: trump.id,
        title: "Seal the border and stop migrant invasion",
        description:
          "Pledged to seal the southern border and end illegal immigration on day one.",
        category: "Immigration",
        dateMade: new Date("2024-07-18"),
        status: PromiseStatus.FIGHTING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: trump.id,
        title: "End inflation and make America affordable again",
        description:
          "Promised to rapidly bring down inflation and reduce costs for American families.",
        category: "Economy",
        dateMade: new Date("2024-07-18"),
        status: PromiseStatus.NOTHING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: trump.id,
        title: "Make America the dominant energy producer",
        description:
          "Pledged to unleash American energy production including oil, gas, and nuclear.",
        category: "Environment",
        dateMade: new Date("2024-07-18"),
        status: PromiseStatus.FIGHTING,
      },
    }),
    prisma.promise.create({
      data: {
        politicianId: trump.id,
        title: "No taxes on tips",
        description:
          "Promised to eliminate federal taxes on tips for service workers.",
        category: "Tax Policy",
        dateMade: new Date("2024-06-09"),
        status: PromiseStatus.NOTHING,
      },
    }),
  ]);

  const [trumpBorder, trumpInflation, trumpEnergy, trumpTips] = trumpPromises;

  await prisma.promiseStatusChange.createMany({
    data: [
      // Border: started immediately
      { promiseId: trumpBorder.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2025-01-20") },
      { promiseId: trumpBorder.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2025-01-20"), note: "Executive orders on border security signed day one" },

      // Inflation: no concrete action
      { promiseId: trumpInflation.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2025-01-20") },

      // Energy: started
      { promiseId: trumpEnergy.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2025-01-20") },
      { promiseId: trumpEnergy.id, oldStatus: "NOTHING", newStatus: "FIGHTING", changedAt: new Date("2025-01-23"), note: "National energy emergency declared" },

      // Tips: no action yet
      { promiseId: trumpTips.id, oldStatus: null, newStatus: "NOTHING", changedAt: new Date("2025-01-20") },
    ],
  });

  // ===== BILLS AND VOTES =====

  // US Bills
  const usBills = await Promise.all([
    prisma.bill.create({
      data: {
        title: "Infrastructure Investment and Jobs Act",
        summary: "A $1.2 trillion package to rebuild roads, bridges, and railways, expand broadband internet access, and upgrade water systems across America. Think of it as a massive upgrade to the country's physical backbone.",
        billNumber: "H.R.3684",
        category: "Economy",
        country: Country.US,
        session: "117th Congress",
        dateVoted: new Date("2021-11-05"),
        sourceUrl: "https://www.congress.gov/bill/117th-congress/house-bill/3684",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Inflation Reduction Act",
        summary: "The biggest climate investment in US history — $369 billion for clean energy, plus letting Medicare negotiate some drug prices and extending healthcare subsidies. Despite the name, it's mostly a climate and health bill.",
        billNumber: "H.R.5376",
        category: "Environment",
        country: Country.US,
        session: "117th Congress",
        dateVoted: new Date("2022-08-12"),
        sourceUrl: "https://www.congress.gov/bill/117th-congress/house-bill/5376",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Bipartisan Safer Communities Act",
        summary: "The first major federal gun safety law in nearly 30 years. It tightened background checks for buyers under 21, funded state crisis intervention programs, and closed the 'boyfriend loophole' in domestic violence gun restrictions.",
        billNumber: "S.2938",
        category: "Justice",
        country: Country.US,
        session: "117th Congress",
        dateVoted: new Date("2022-06-25"),
        sourceUrl: "https://www.congress.gov/bill/117th-congress/senate-bill/2938",
      },
    }),
    prisma.bill.create({
      data: {
        title: "CHIPS and Science Act",
        summary: "Invested $280 billion to bring semiconductor manufacturing back to the US and boost scientific research. Basically, a bet that America should make its own computer chips instead of depending on Asia.",
        billNumber: "H.R.4346",
        category: "Economy",
        country: Country.US,
        session: "117th Congress",
        dateVoted: new Date("2022-07-28"),
        sourceUrl: "https://www.congress.gov/bill/117th-congress/house-bill/4346",
      },
    }),
    prisma.bill.create({
      data: {
        title: "American Rescue Plan Act",
        summary: "A $1.9 trillion COVID-19 relief package that sent $1,400 stimulus checks to most Americans, extended unemployment benefits, funded vaccine distribution, and gave billions to schools and local governments.",
        billNumber: "H.R.1319",
        category: "Healthcare",
        country: Country.US,
        session: "117th Congress",
        dateVoted: new Date("2021-03-10"),
        sourceUrl: "https://www.congress.gov/bill/117th-congress/house-bill/1319",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Respect for Marriage Act",
        summary: "Legally protected same-sex and interracial marriages at the federal level. If any state tried to ban these marriages, the federal government would still recognize them.",
        billNumber: "H.R.8404",
        category: "Justice",
        country: Country.US,
        session: "117th Congress",
        dateVoted: new Date("2022-12-08"),
        sourceUrl: "https://www.congress.gov/bill/117th-congress/house-bill/8404",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Tax Cuts and Jobs Act",
        summary: "The signature tax overhaul of the Trump era — slashed the corporate tax rate from 35% to 21%, temporarily lowered individual tax brackets, and capped state/local tax deductions. Critics said it mostly helped the wealthy; supporters said it boosted the economy.",
        billNumber: "H.R.1",
        category: "Economy",
        country: Country.US,
        session: "115th Congress",
        dateVoted: new Date("2017-12-20"),
        sourceUrl: "https://www.congress.gov/bill/115th-congress/house-bill/1",
      },
    }),
    prisma.bill.create({
      data: {
        title: "First Step Act",
        summary: "A rare bipartisan criminal justice reform that reduced mandatory minimum sentences for nonviolent drug offenses, gave judges more flexibility in sentencing, and expanded programs to help inmates re-enter society.",
        billNumber: "S.756",
        category: "Justice",
        country: Country.US,
        session: "115th Congress",
        dateVoted: new Date("2018-12-18"),
        sourceUrl: "https://www.congress.gov/bill/115th-congress/senate-bill/756",
      },
    }),
    prisma.bill.create({
      data: {
        title: "USMCA Implementation Act",
        summary: "Replaced NAFTA with an updated trade deal between the US, Mexico, and Canada. Included new rules on auto manufacturing, digital trade, and labor protections — basically NAFTA 2.0 with some worker-friendly tweaks.",
        billNumber: "H.R.5430",
        category: "Economy",
        country: Country.US,
        session: "116th Congress",
        dateVoted: new Date("2020-01-16"),
        sourceUrl: "https://www.congress.gov/bill/116th-congress/house-bill/5430",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Consolidated Appropriations Act, 2021 (COVID Relief)",
        summary: "A $900 billion COVID relief bill bundled into a larger spending package. Sent $600 stimulus checks, extended unemployment benefits, funded vaccine distribution, and provided PPP loans for small businesses.",
        billNumber: "H.R.133",
        category: "Economy",
        country: Country.US,
        session: "116th Congress",
        dateVoted: new Date("2020-12-21"),
        sourceUrl: "https://www.congress.gov/bill/116th-congress/house-bill/133",
      },
    }),
  ]);

  const [infraBill, iraBill, saferCommBill, chipsBill, rescuePlanBill, marriageBill, taxCutsBill, firstStepBill, usmcaBill, covidReliefBill] = usBills;

  // Canadian Bills
  const caBills = await Promise.all([
    prisma.bill.create({
      data: {
        title: "Online Streaming Act",
        summary: "Extended Canadian broadcasting regulations to cover streaming platforms like Netflix and Spotify. The goal was to ensure Canadian content gets promoted on these platforms, but critics worried it could regulate user-generated content too.",
        billNumber: "C-11",
        category: "Technology",
        country: Country.CA,
        session: "44th Parliament",
        dateVoted: new Date("2023-04-27"),
        sourceUrl: "https://www.parl.ca/legisinfo/en/bill/44-1/c-11",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Online News Act",
        summary: "Required tech giants like Google and Meta to pay Canadian news outlets for sharing their content. Meta responded by blocking news in Canada entirely. Think of it as Canada trying to make Big Tech fund journalism.",
        billNumber: "C-18",
        category: "Technology",
        country: Country.CA,
        session: "44th Parliament",
        dateVoted: new Date("2023-06-22"),
        sourceUrl: "https://www.parl.ca/legisinfo/en/bill/44-1/c-18",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Firearms Amendments Act",
        summary: "Froze the buying and selling of handguns in Canada and tightened restrictions on assault-style weapons. Part of the government's response to mass shootings, though the promised mandatory buyback program was scaled back.",
        billNumber: "C-21",
        category: "Justice",
        country: Country.CA,
        session: "44th Parliament",
        dateVoted: new Date("2023-12-15"),
        sourceUrl: "https://www.parl.ca/legisinfo/en/bill/44-1/c-21",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Impact Assessment Act",
        summary: "Overhauled how Canada evaluates the environmental impact of major projects like pipelines and mines. It gave the federal government more say over provincial resource projects — which Alberta really didn't like.",
        billNumber: "C-69",
        category: "Environment",
        country: Country.CA,
        session: "42nd Parliament",
        dateVoted: new Date("2019-06-20"),
        sourceUrl: "https://www.parl.ca/legisinfo/en/bill/42-1/c-69",
      },
    }),
    prisma.bill.create({
      data: {
        title: "Medical Assistance in Dying Amendments",
        summary: "Expanded who qualifies for medically assisted death in Canada, removing the requirement that death be 'reasonably foreseeable.' It opened the door for people with chronic but non-terminal conditions to access MAID.",
        billNumber: "C-7",
        category: "Healthcare",
        country: Country.CA,
        session: "43rd Parliament",
        dateVoted: new Date("2021-03-17"),
        sourceUrl: "https://www.parl.ca/legisinfo/en/bill/43-2/c-7",
      },
    }),
  ]);

  const [streamingBill, newsBill, firearmsBill, impactBill, maidBill] = caBills;

  // Create votes - Biden
  await prisma.vote.createMany({
    data: [
      { politicianId: biden.id, billId: infraBill.id, position: VotePosition.YEA },
      { politicianId: biden.id, billId: iraBill.id, position: VotePosition.YEA },
      { politicianId: biden.id, billId: saferCommBill.id, position: VotePosition.YEA },
      { politicianId: biden.id, billId: chipsBill.id, position: VotePosition.YEA },
      { politicianId: biden.id, billId: rescuePlanBill.id, position: VotePosition.YEA },
      { politicianId: biden.id, billId: marriageBill.id, position: VotePosition.YEA },
      // Biden voted for Tax Cuts as a senator? No, he wasn't in office. Let's skip that.
      // Biden supported USMCA
      { politicianId: biden.id, billId: usmcaBill.id, position: VotePosition.YEA },
      { politicianId: biden.id, billId: covidReliefBill.id, position: VotePosition.YEA },
    ],
  });

  // Create votes - Trump (as president, signed/supported these)
  await prisma.vote.createMany({
    data: [
      { politicianId: trump.id, billId: taxCutsBill.id, position: VotePosition.YEA },
      { politicianId: trump.id, billId: firstStepBill.id, position: VotePosition.YEA },
      { politicianId: trump.id, billId: usmcaBill.id, position: VotePosition.YEA },
      { politicianId: trump.id, billId: covidReliefBill.id, position: VotePosition.YEA },
      // Trump opposed these Biden-era bills
      { politicianId: trump.id, billId: infraBill.id, position: VotePosition.NAY },
      { politicianId: trump.id, billId: iraBill.id, position: VotePosition.NAY },
      { politicianId: trump.id, billId: rescuePlanBill.id, position: VotePosition.NAY },
      { politicianId: trump.id, billId: marriageBill.id, position: VotePosition.NAY },
      // Absent on CHIPS vote
      { politicianId: trump.id, billId: chipsBill.id, position: VotePosition.ABSENT },
      // Abstained on gun safety
      { politicianId: trump.id, billId: saferCommBill.id, position: VotePosition.ABSTAIN },
    ],
  });

  // Create votes - Trudeau
  await prisma.vote.createMany({
    data: [
      { politicianId: trudeau.id, billId: streamingBill.id, position: VotePosition.YEA },
      { politicianId: trudeau.id, billId: newsBill.id, position: VotePosition.YEA },
      { politicianId: trudeau.id, billId: firearmsBill.id, position: VotePosition.YEA },
      { politicianId: trudeau.id, billId: impactBill.id, position: VotePosition.YEA },
      { politicianId: trudeau.id, billId: maidBill.id, position: VotePosition.YEA },
    ],
  });

  // ===== DONORS =====

  // US Corporate Donors
  const [kochInd, goldmanSachs, googleAlpha, pfizer, lockheedMartin, amazon, jpmorgan, exxonMobil] = await Promise.all([
    prisma.donor.create({ data: { name: "Koch Industries", type: DonorType.CORPORATION, industry: "Oil & Gas", country: Country.US } }),
    prisma.donor.create({ data: { name: "Goldman Sachs", type: DonorType.CORPORATION, industry: "Finance", country: Country.US } }),
    prisma.donor.create({ data: { name: "Alphabet (Google)", type: DonorType.CORPORATION, industry: "Technology", country: Country.US } }),
    prisma.donor.create({ data: { name: "Pfizer Inc.", type: DonorType.CORPORATION, industry: "Pharmaceutical", country: Country.US } }),
    prisma.donor.create({ data: { name: "Lockheed Martin", type: DonorType.CORPORATION, industry: "Defense", country: Country.US } }),
    prisma.donor.create({ data: { name: "Amazon", type: DonorType.CORPORATION, industry: "Technology", country: Country.US } }),
    prisma.donor.create({ data: { name: "JPMorgan Chase", type: DonorType.CORPORATION, industry: "Finance", country: Country.US } }),
    prisma.donor.create({ data: { name: "ExxonMobil", type: DonorType.CORPORATION, industry: "Oil & Gas", country: Country.US } }),
  ]);

  // US PACs/Super PACs
  const [americanCrossroads, prioritiesUSA, nraPVF, plannedParenthood] = await Promise.all([
    prisma.donor.create({ data: { name: "American Crossroads", type: DonorType.SUPER_PAC, industry: "Political", country: Country.US } }),
    prisma.donor.create({ data: { name: "Priorities USA Action", type: DonorType.SUPER_PAC, industry: "Political", country: Country.US } }),
    prisma.donor.create({ data: { name: "NRA Political Victory Fund", type: DonorType.PAC, industry: "Defense", country: Country.US } }),
    prisma.donor.create({ data: { name: "Planned Parenthood Action Fund", type: DonorType.PAC, industry: "Healthcare", country: Country.US } }),
  ]);

  // US Unions
  const [nea, teamsters] = await Promise.all([
    prisma.donor.create({ data: { name: "National Education Association", type: DonorType.UNION, industry: "Education", country: Country.US } }),
    prisma.donor.create({ data: { name: "International Brotherhood of Teamsters", type: DonorType.UNION, industry: "Transportation", country: Country.US } }),
  ]);

  // US Individual Donors
  const [richardMuir, sarahChen, markDellworth, tanyaVoss, jamesHolbrook, lindaPark] = await Promise.all([
    prisma.donor.create({ data: { name: "Richard Muir", type: DonorType.INDIVIDUAL, industry: "Real Estate", country: Country.US } }),
    prisma.donor.create({ data: { name: "Sarah Chen", type: DonorType.INDIVIDUAL, industry: "Technology", country: Country.US } }),
    prisma.donor.create({ data: { name: "Mark Dellworth", type: DonorType.INDIVIDUAL, industry: "Finance", country: Country.US } }),
    prisma.donor.create({ data: { name: "Tanya Voss", type: DonorType.INDIVIDUAL, industry: "Healthcare", country: Country.US } }),
    prisma.donor.create({ data: { name: "James Holbrook", type: DonorType.INDIVIDUAL, industry: "Oil & Gas", country: Country.US } }),
    prisma.donor.create({ data: { name: "Linda Park", type: DonorType.INDIVIDUAL, industry: "Entertainment", country: Country.US } }),
  ]);

  // Canadian Donors
  const [sncLavalin, suncorEnergy, shopify, manulife] = await Promise.all([
    prisma.donor.create({ data: { name: "SNC-Lavalin", type: DonorType.CORPORATION, industry: "Engineering", country: Country.CA } }),
    prisma.donor.create({ data: { name: "Suncor Energy", type: DonorType.CORPORATION, industry: "Oil & Gas", country: Country.CA } }),
    prisma.donor.create({ data: { name: "Shopify", type: DonorType.CORPORATION, industry: "Technology", country: Country.CA } }),
    prisma.donor.create({ data: { name: "Manulife Financial", type: DonorType.CORPORATION, industry: "Finance", country: Country.CA } }),
  ]);

  const [clc, unifor] = await Promise.all([
    prisma.donor.create({ data: { name: "Canadian Labour Congress", type: DonorType.UNION, industry: "Labour", country: Country.CA } }),
    prisma.donor.create({ data: { name: "Unifor", type: DonorType.UNION, industry: "Manufacturing", country: Country.CA } }),
  ]);

  const [pierreBeaulieu, amritaSingh, danielLefebvre, marieCloutier] = await Promise.all([
    prisma.donor.create({ data: { name: "Pierre Beaulieu", type: DonorType.INDIVIDUAL, industry: "Real Estate", country: Country.CA } }),
    prisma.donor.create({ data: { name: "Amrita Singh", type: DonorType.INDIVIDUAL, industry: "Technology", country: Country.CA } }),
    prisma.donor.create({ data: { name: "Daniel Lefebvre", type: DonorType.INDIVIDUAL, industry: "Finance", country: Country.CA } }),
    prisma.donor.create({ data: { name: "Marie Cloutier", type: DonorType.INDIVIDUAL, industry: "Healthcare", country: Country.CA } }),
  ]);

  // ===== DONATIONS =====

  await prisma.donation.createMany({
    data: [
      // Biden donations — 2020 cycle
      { donorId: goldmanSachs.id, politicianId: biden.id, amount: 350000, date: new Date("2020-06-15"), electionCycle: "2020" },
      { donorId: googleAlpha.id, politicianId: biden.id, amount: 275000, date: new Date("2020-07-20"), electionCycle: "2020" },
      { donorId: pfizer.id, politicianId: biden.id, amount: 200000, date: new Date("2020-08-10"), electionCycle: "2020" },
      { donorId: amazon.id, politicianId: biden.id, amount: 180000, date: new Date("2020-05-22"), electionCycle: "2020" },
      { donorId: jpmorgan.id, politicianId: biden.id, amount: 300000, date: new Date("2020-09-01"), electionCycle: "2020" },
      { donorId: prioritiesUSA.id, politicianId: biden.id, amount: 500000, date: new Date("2020-10-05"), electionCycle: "2020" },
      { donorId: plannedParenthood.id, politicianId: biden.id, amount: 150000, date: new Date("2020-07-30"), electionCycle: "2020" },
      { donorId: nea.id, politicianId: biden.id, amount: 250000, date: new Date("2020-08-25"), electionCycle: "2020" },
      { donorId: teamsters.id, politicianId: biden.id, amount: 175000, date: new Date("2020-09-15"), electionCycle: "2020" },
      { donorId: sarahChen.id, politicianId: biden.id, amount: 5800, date: new Date("2020-06-01"), electionCycle: "2020" },
      { donorId: tanyaVoss.id, politicianId: biden.id, amount: 2900, date: new Date("2020-07-15"), electionCycle: "2020" },
      { donorId: lindaPark.id, politicianId: biden.id, amount: 8500, date: new Date("2020-09-20"), electionCycle: "2020" },
      // Biden also gets some from donors who give to both sides
      { donorId: lockheedMartin.id, politicianId: biden.id, amount: 120000, date: new Date("2020-08-05"), electionCycle: "2020" },
      { donorId: exxonMobil.id, politicianId: biden.id, amount: 75000, date: new Date("2020-07-01"), electionCycle: "2020" },

      // Trump donations — 2020 cycle
      { donorId: kochInd.id, politicianId: trump.id, amount: 450000, date: new Date("2020-03-15"), electionCycle: "2020" },
      { donorId: exxonMobil.id, politicianId: trump.id, amount: 380000, date: new Date("2020-04-20"), electionCycle: "2020" },
      { donorId: lockheedMartin.id, politicianId: trump.id, amount: 250000, date: new Date("2020-05-10"), electionCycle: "2020" },
      { donorId: americanCrossroads.id, politicianId: trump.id, amount: 500000, date: new Date("2020-06-15"), electionCycle: "2020" },
      { donorId: nraPVF.id, politicianId: trump.id, amount: 350000, date: new Date("2020-07-01"), electionCycle: "2020" },
      { donorId: goldmanSachs.id, politicianId: trump.id, amount: 200000, date: new Date("2020-06-01"), electionCycle: "2020" },
      { donorId: jpmorgan.id, politicianId: trump.id, amount: 175000, date: new Date("2020-05-15"), electionCycle: "2020" },
      { donorId: richardMuir.id, politicianId: trump.id, amount: 10000, date: new Date("2020-08-01"), electionCycle: "2020" },
      { donorId: jamesHolbrook.id, politicianId: trump.id, amount: 7500, date: new Date("2020-07-15"), electionCycle: "2020" },
      { donorId: markDellworth.id, politicianId: trump.id, amount: 5000, date: new Date("2020-09-01"), electionCycle: "2020" },

      // Trump donations — 2024 cycle
      { donorId: kochInd.id, politicianId: trump.id, amount: 400000, date: new Date("2024-02-10"), electionCycle: "2024" },
      { donorId: exxonMobil.id, politicianId: trump.id, amount: 325000, date: new Date("2024-03-15"), electionCycle: "2024" },
      { donorId: americanCrossroads.id, politicianId: trump.id, amount: 475000, date: new Date("2024-05-20"), electionCycle: "2024" },
      { donorId: nraPVF.id, politicianId: trump.id, amount: 300000, date: new Date("2024-04-01"), electionCycle: "2024" },
      { donorId: lockheedMartin.id, politicianId: trump.id, amount: 200000, date: new Date("2024-06-10"), electionCycle: "2024" },
      { donorId: richardMuir.id, politicianId: trump.id, amount: 8500, date: new Date("2024-07-01"), electionCycle: "2024" },
      { donorId: jamesHolbrook.id, politicianId: trump.id, amount: 6000, date: new Date("2024-06-15"), electionCycle: "2024" },
      // Some tech donors hedging bets in 2024
      { donorId: googleAlpha.id, politicianId: trump.id, amount: 150000, date: new Date("2024-08-01"), electionCycle: "2024" },
      { donorId: amazon.id, politicianId: trump.id, amount: 125000, date: new Date("2024-07-20"), electionCycle: "2024" },

      // Biden donations — 2024 cycle (before dropping out)
      { donorId: prioritiesUSA.id, politicianId: biden.id, amount: 400000, date: new Date("2024-01-15"), electionCycle: "2024" },
      { donorId: googleAlpha.id, politicianId: biden.id, amount: 200000, date: new Date("2024-02-20"), electionCycle: "2024" },
      { donorId: pfizer.id, politicianId: biden.id, amount: 150000, date: new Date("2024-03-10"), electionCycle: "2024" },
      { donorId: nea.id, politicianId: biden.id, amount: 225000, date: new Date("2024-04-01"), electionCycle: "2024" },

      // Trudeau donations — 2021 Federal
      { donorId: sncLavalin.id, politicianId: trudeau.id, amount: 95000, date: new Date("2021-08-20"), electionCycle: "2021 Federal" },
      { donorId: suncorEnergy.id, politicianId: trudeau.id, amount: 80000, date: new Date("2021-09-01"), electionCycle: "2021 Federal" },
      { donorId: shopify.id, politicianId: trudeau.id, amount: 65000, date: new Date("2021-08-15"), electionCycle: "2021 Federal" },
      { donorId: manulife.id, politicianId: trudeau.id, amount: 72000, date: new Date("2021-09-05"), electionCycle: "2021 Federal" },
      { donorId: clc.id, politicianId: trudeau.id, amount: 110000, date: new Date("2021-08-25"), electionCycle: "2021 Federal" },
      { donorId: unifor.id, politicianId: trudeau.id, amount: 85000, date: new Date("2021-09-10"), electionCycle: "2021 Federal" },
      { donorId: pierreBeaulieu.id, politicianId: trudeau.id, amount: 1650, date: new Date("2021-08-18"), electionCycle: "2021 Federal" },
      { donorId: amritaSingh.id, politicianId: trudeau.id, amount: 1500, date: new Date("2021-09-01"), electionCycle: "2021 Federal" },
      { donorId: danielLefebvre.id, politicianId: trudeau.id, amount: 1650, date: new Date("2021-09-08"), electionCycle: "2021 Federal" },
      { donorId: marieCloutier.id, politicianId: trudeau.id, amount: 800, date: new Date("2021-08-30"), electionCycle: "2021 Federal" },
    ],
  });

  // ===== LOBBYING RECORDS =====

  await prisma.lobbyingRecord.createMany({
    data: [
      // Biden lobbying — note: Pfizer lobbies on healthcare, then Biden voted YEA on healthcare bills
      { lobbyistName: "Cornerstone Government Affairs", clientName: "Pfizer Inc.", clientIndustry: "Pharmaceutical", politicianId: biden.id, issue: "Drug Pricing and Medicare Negotiation", amount: 4200000, year: 2021 },
      { lobbyistName: "Akin Gump Strauss Hauer & Feld", clientName: "Amazon", clientIndustry: "Technology", politicianId: biden.id, issue: "Antitrust Regulation and Labor Law", amount: 3800000, year: 2022 },
      { lobbyistName: "Holland & Knight", clientName: "Goldman Sachs", clientIndustry: "Finance", politicianId: biden.id, issue: "Financial Regulation and Banking Reform", amount: 2900000, year: 2021 },
      { lobbyistName: "Brownstein Hyatt Farber Schreck", clientName: "Alphabet (Google)", clientIndustry: "Technology", politicianId: biden.id, issue: "Data Privacy Regulation", amount: 3500000, year: 2022 },
      { lobbyistName: "BGR Group", clientName: "Lockheed Martin", clientIndustry: "Defense", politicianId: biden.id, issue: "Defense Appropriations and Military Contracts", amount: 5100000, year: 2023 },
      // ExxonMobil lobbies Biden on environment — interesting given Biden's climate promises
      { lobbyistName: "Vinson & Elkins", clientName: "ExxonMobil", clientIndustry: "Oil & Gas", politicianId: biden.id, issue: "Environmental Deregulation and Carbon Tax", amount: 2100000, year: 2022 },

      // Trump lobbying — Oil & Gas lobby heavily, then Trump voted NAY on climate bill (IRA)
      { lobbyistName: "Pinnacle Policy Group", clientName: "American Petroleum Institute", clientIndustry: "Oil & Gas", politicianId: trump.id, issue: "Environmental Deregulation", amount: 6800000, year: 2024 },
      { lobbyistName: "S-3 Group", clientName: "Koch Industries", clientIndustry: "Oil & Gas", politicianId: trump.id, issue: "Tax Reform and Deregulation", amount: 4500000, year: 2024 },
      { lobbyistName: "Cassidy & Associates", clientName: "ExxonMobil", clientIndustry: "Oil & Gas", politicianId: trump.id, issue: "Energy Production and Drilling Permits", amount: 3900000, year: 2024 },
      { lobbyistName: "Fierce Government Relations", clientName: "National Rifle Association", clientIndustry: "Defense", politicianId: trump.id, issue: "Second Amendment and Gun Rights", amount: 2200000, year: 2020 },
      { lobbyistName: "Invariant", clientName: "JPMorgan Chase", clientIndustry: "Finance", politicianId: trump.id, issue: "Financial Deregulation", amount: 3100000, year: 2020 },
      { lobbyistName: "Capitol Counsel", clientName: "Lockheed Martin", clientIndustry: "Defense", politicianId: trump.id, issue: "Defense Spending and Arms Sales", amount: 4700000, year: 2020 },
      // Tech companies hedging bets by lobbying Trump too
      { lobbyistName: "Franklin Square Group", clientName: "Amazon", clientIndustry: "Technology", politicianId: trump.id, issue: "Antitrust and Postal Service Contracts", amount: 2800000, year: 2024 },

      // Trudeau lobbying — SNC-Lavalin lobbied heavily (echoes real scandal)
      { lobbyistName: "Temple Scott Associates", clientName: "SNC-Lavalin", clientIndustry: "Engineering", politicianId: trudeau.id, issue: "Deferred Prosecution Agreements", amount: 850000, year: 2021 },
      { lobbyistName: "Earnscliffe Strategy Group", clientName: "Suncor Energy", clientIndustry: "Oil & Gas", politicianId: trudeau.id, issue: "Pipeline Approvals and Carbon Pricing", amount: 720000, year: 2022 },
      { lobbyistName: "Global Public Affairs", clientName: "Canadian Bankers Association", clientIndustry: "Finance", politicianId: trudeau.id, issue: "Open Banking Framework", amount: 480000, year: 2022 },
      { lobbyistName: "Hill+Knowlton Strategies", clientName: "Innovative Medicines Canada", clientIndustry: "Pharmaceutical", politicianId: trudeau.id, issue: "Pharmacare and Drug Pricing", amount: 620000, year: 2023 },
      { lobbyistName: "Crestview Strategy", clientName: "Meta Platforms", clientIndustry: "Technology", politicianId: trudeau.id, issue: "Online News Act and Content Regulation", amount: 550000, year: 2023 },
    ],
  });

  console.log("Seeded 4 politicians with promises, status changes, bills, votes, donors, donations, and lobbying records!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

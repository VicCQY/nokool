import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

const VALID_COUNTRIES = ["US", "CA", "UK", "AU", "FR", "DE"];
const VALID_CATEGORIES = [
  "Economy",
  "Healthcare",
  "Environment",
  "Immigration",
  "Education",
  "Infrastructure",
  "Foreign Policy",
  "Justice",
  "Housing",
  "Technology",
  "Other",
];
const VALID_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "FULFILLED",
  "PARTIAL",
  "BROKEN",
];

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  // XLSX may return a JS Date object or a serial number
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d);
    return null;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function str(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Only .xlsx files are accepted" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    // Read Politicians sheet
    const polSheet = workbook.Sheets["Politicians"];
    const promSheet = workbook.Sheets["Promises"];

    if (!polSheet) {
      return NextResponse.json(
        { error: 'Spreadsheet is missing the "Politicians" sheet' },
        { status: 400 }
      );
    }
    if (!promSheet) {
      return NextResponse.json(
        { error: 'Spreadsheet is missing the "Promises" sheet' },
        { status: 400 }
      );
    }

    // Parse sheets to arrays of arrays (raw rows)
    const polRows: unknown[][] = XLSX.utils.sheet_to_json(polSheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const promRows: unknown[][] = XLSX.utils.sheet_to_json(promSheet, {
      header: 1,
      defval: "",
      raw: false,
    });

    const errors: string[] = [];

    // ── Step 1: Parse & validate politicians (skip rows 0=headers, 1=descriptions) ──
    interface PoliticianRow {
      name: string;
      country: string;
      party: string;
      photoUrl: string;
      termStart: Date;
      termEnd: Date | null;
      inOfficeSince: Date | null;
      branch: string;
      branchProvided: boolean;
      chamber: string | null;
      chamberProvided: boolean;
      state: string | null;
      stateProvided: boolean;
      district: string | null;
      districtProvided: boolean;
      rowNum: number;
    }

    const politicianRows: PoliticianRow[] = [];

    for (let i = 2; i < polRows.length; i++) {
      const row = polRows[i];
      if (!row || row.every((c) => !str(c))) continue; // skip empty rows

      const rowNum = i + 1; // 1-indexed for user display
      const name = str(row[0]);
      const country = str(row[1]).toUpperCase();
      const party = str(row[2]);
      const photoUrl = str(row[3]);
      const termStartRaw = row[4];
      const termEndRaw = row[5];
      const inOfficeSinceRaw = row[6];
      const branchRaw = str(row[7]).toLowerCase();
      const chamberRaw = str(row[8]).toLowerCase();
      const stateRaw = str(row[9]).toUpperCase();
      const districtRaw = str(row[10]);

      if (!name) errors.push(`Politicians sheet, row ${rowNum}: name is required`);
      if (!VALID_COUNTRIES.includes(country))
        errors.push(
          `Politicians sheet, row ${rowNum}: country '${str(row[1])}' must be one of ${VALID_COUNTRIES.join(", ")}`
        );
      if (!party) errors.push(`Politicians sheet, row ${rowNum}: party is required`);

      const termStart = parseDate(termStartRaw);
      if (!termStart)
        errors.push(
          `Politicians sheet, row ${rowNum}: termStart '${str(termStartRaw)}' is not a valid date`
        );

      const termEnd = termEndRaw ? parseDate(termEndRaw) : null;
      if (termEndRaw && str(termEndRaw) && !termEnd)
        errors.push(
          `Politicians sheet, row ${rowNum}: termEnd '${str(termEndRaw)}' is not a valid date`
        );

      const inOfficeSince = inOfficeSinceRaw ? parseDate(inOfficeSinceRaw) : null;
      if (inOfficeSinceRaw && str(inOfficeSinceRaw) && !inOfficeSince)
        errors.push(
          `Politicians sheet, row ${rowNum}: inOfficeSince '${str(inOfficeSinceRaw)}' is not a valid date`
        );

      const branch = branchRaw || "legislative";
      if (!["executive", "legislative"].includes(branch))
        errors.push(
          `Politicians sheet, row ${rowNum}: branch '${str(row[7])}' must be 'executive' or 'legislative'`
        );

      const chamber = chamberRaw || null;
      if (chamber && !["house", "senate"].includes(chamber))
        errors.push(
          `Politicians sheet, row ${rowNum}: chamber '${str(row[8])}' must be 'house' or 'senate'`
        );

      if (name && VALID_COUNTRIES.includes(country) && party && termStart) {
        politicianRows.push({
          name,
          country,
          party,
          photoUrl,
          termStart,
          termEnd,
          inOfficeSince,
          branch,
          branchProvided: !!branchRaw,
          chamber,
          chamberProvided: !!chamberRaw,
          state: stateRaw || null,
          stateProvided: !!stateRaw,
          district: districtRaw || null,
          districtProvided: !!districtRaw,
          rowNum,
        });
      }
    }

    // ── Step 2: Parse & validate promises ──
    interface PromiseRow {
      politicianName: string;
      title: string;
      description: string;
      category: string;
      status: string;
      dateMade: Date;
      sourceUrl: string;
      weight: number;
      expectedMonths: number | null;
      rowNum: number;
    }

    const promiseRows: PromiseRow[] = [];

    for (let i = 2; i < promRows.length; i++) {
      const row = promRows[i];
      if (!row || row.every((c) => !str(c))) continue;

      const rowNum = i + 1;
      const politicianName = str(row[0]);
      const title = str(row[1]);
      const description = str(row[2]);
      const category = str(row[3]);
      const status = str(row[4]).toUpperCase().replace(/ /g, "_");
      const dateMadeRaw = row[5];
      const sourceUrl = str(row[6]);
      const weightRaw = str(row[7]);
      let weight = 3;
      if (weightRaw) {
        const parsed = parseInt(weightRaw, 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 5) {
          errors.push(
            `Promises sheet, row ${rowNum}: weight '${weightRaw}' must be between 1 and 5`
          );
        } else {
          weight = parsed;
        }
      }
      const expectedMonthsRaw = str(row[8]);
      let expectedMonths: number | null = null;
      if (expectedMonthsRaw) {
        const parsed = parseInt(expectedMonthsRaw, 10);
        if (isNaN(parsed) || parsed < 1) {
          errors.push(
            `Promises sheet, row ${rowNum}: expectedMonths '${expectedMonthsRaw}' must be a positive integer`
          );
        } else {
          expectedMonths = parsed;
        }
      }

      if (!politicianName)
        errors.push(`Promises sheet, row ${rowNum}: politicianName is required`);
      if (!title)
        errors.push(`Promises sheet, row ${rowNum}: title is required`);
      if (!VALID_CATEGORIES.includes(category))
        errors.push(
          `Promises sheet, row ${rowNum}: category '${str(row[3])}' is not valid. Must be one of: ${VALID_CATEGORIES.join(", ")}`
        );
      if (!VALID_STATUSES.includes(status))
        errors.push(
          `Promises sheet, row ${rowNum}: status '${str(row[4])}' is not valid. Must be one of: ${VALID_STATUSES.join(", ")}`
        );

      const dateMade = parseDate(dateMadeRaw);
      if (!dateMade)
        errors.push(
          `Promises sheet, row ${rowNum}: dateMade '${str(dateMadeRaw)}' is not a valid date`
        );

      if (
        politicianName &&
        title &&
        VALID_CATEGORIES.includes(category) &&
        VALID_STATUSES.includes(status) &&
        dateMade
      ) {
        promiseRows.push({
          politicianName,
          title,
          description,
          category,
          status,
          dateMade,
          sourceUrl,
          weight,
          expectedMonths,
          rowNum,
        });
      }
    }

    // ── Step 3: Parse & validate Status History (optional sheet) ──
    interface StatusHistoryRow {
      politicianName: string;
      promiseTitle: string;
      oldStatus: string;
      newStatus: string;
      changedAt: Date;
      note: string;
      rowNum: number;
    }

    const statusHistoryRows: StatusHistoryRow[] = [];
    const histSheet = workbook.Sheets["Status History"];

    if (histSheet) {
      const histRows: unknown[][] = XLSX.utils.sheet_to_json(histSheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      for (let i = 2; i < histRows.length; i++) {
        const row = histRows[i];
        if (!row || row.every((c) => !str(c))) continue;

        const rowNum = i + 1;
        const politicianName = str(row[0]);
        const promiseTitle = str(row[1]);
        const oldStatus = str(row[2]).toUpperCase().replace(/ /g, "_");
        const newStatus = str(row[3]).toUpperCase().replace(/ /g, "_");
        const changedAtRaw = row[4];
        const note = str(row[5]);

        if (!politicianName)
          errors.push(`Status History sheet, row ${rowNum}: politicianName is required`);
        if (!promiseTitle)
          errors.push(`Status History sheet, row ${rowNum}: promiseTitle is required`);
        if (!VALID_STATUSES.includes(newStatus))
          errors.push(
            `Status History sheet, row ${rowNum}: newStatus '${str(row[3])}' is not valid. Must be one of: ${VALID_STATUSES.join(", ")}`
          );
        if (oldStatus && !VALID_STATUSES.includes(oldStatus))
          errors.push(
            `Status History sheet, row ${rowNum}: oldStatus '${str(row[2])}' is not valid. Must be one of: ${VALID_STATUSES.join(", ")} (or leave empty)`
          );

        const changedAt = parseDate(changedAtRaw);
        if (!changedAt)
          errors.push(
            `Status History sheet, row ${rowNum}: changedAt '${str(changedAtRaw)}' is not a valid date`
          );

        if (
          politicianName &&
          promiseTitle &&
          VALID_STATUSES.includes(newStatus) &&
          (!oldStatus || VALID_STATUSES.includes(oldStatus)) &&
          changedAt
        ) {
          statusHistoryRows.push({
            politicianName,
            promiseTitle,
            oldStatus,
            newStatus,
            changedAt,
            note,
            rowNum,
          });
        }
      }
    }

    // ── Step 4: Check politician name matching ──
    const sheetPoliticianNames = new Set(politicianRows.map((p) => p.name));

    // Also check existing politicians in the database
    const existingPoliticians = await prisma.politician.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existingPoliticians.map((p) => p.name));

    for (const prom of promiseRows) {
      if (
        !sheetPoliticianNames.has(prom.politicianName) &&
        !existingNames.has(prom.politicianName)
      ) {
        errors.push(
          `Promises sheet, row ${prom.rowNum}: politicianName '${prom.politicianName}' does not match any politician`
        );
      }
    }

    // Check status history politician + promise matching
    const sheetPromiseTitles = new Set(
      promiseRows.map((p) => `${p.politicianName}::${p.title}`)
    );

    for (const sh of statusHistoryRows) {
      if (
        !sheetPoliticianNames.has(sh.politicianName) &&
        !existingNames.has(sh.politicianName)
      ) {
        errors.push(
          `Status History sheet, row ${sh.rowNum}: politicianName '${sh.politicianName}' does not match any politician`
        );
      }
      if (!sheetPromiseTitles.has(`${sh.politicianName}::${sh.promiseTitle}`)) {
        // Check if the promise exists in the database
        const dbPromise = await prisma.promise.findFirst({
          where: {
            title: sh.promiseTitle,
            politician: { name: sh.politicianName },
          },
        });
        if (!dbPromise) {
          errors.push(
            `Status History sheet, row ${sh.rowNum}: promiseTitle '${sh.promiseTitle}' does not match any promise for '${sh.politicianName}'`
          );
        }
      }
    }

    // ── Step 5: Return errors or import ──
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    // Upsert politicians
    let politiciansCreated = 0;
    let politiciansUpdated = 0;
    const politicianIdMap: Record<string, string> = {};

    for (const pol of politicianRows) {
      const existing = await prisma.politician.findFirst({
        where: { name: pol.name, country: pol.country as "US" | "CA" | "UK" | "AU" | "FR" | "DE" },
      });

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {
          party: pol.party,
          photoUrl: pol.photoUrl || null,
          termStart: pol.termStart,
          termEnd: pol.termEnd,
          inOfficeSince: pol.inOfficeSince,
        };
        // Only overwrite branch/chamber/state/district if explicitly provided in spreadsheet
        if (pol.branchProvided) updateData.branch = pol.branch;
        if (pol.chamberProvided) updateData.chamber = pol.chamber;
        if (pol.stateProvided) updateData.state = pol.state;
        if (pol.districtProvided) updateData.district = pol.district;

        await prisma.politician.update({
          where: { id: existing.id },
          data: updateData,
        });
        politicianIdMap[pol.name] = existing.id;
        politiciansUpdated++;
      } else {
        const created = await prisma.politician.create({
          data: {
            name: pol.name,
            country: pol.country as "US" | "CA" | "UK" | "AU" | "FR" | "DE",
            party: pol.party,
            photoUrl: pol.photoUrl || null,
            termStart: pol.termStart,
            termEnd: pol.termEnd,
            inOfficeSince: pol.inOfficeSince,
            branch: pol.branch,
            chamber: pol.chamber,
            state: pol.state,
            district: pol.district,
          },
        });
        politicianIdMap[pol.name] = created.id;
        politiciansCreated++;
      }
    }

    // For promises referencing existing DB politicians not in the sheet
    for (const prom of promiseRows) {
      if (!politicianIdMap[prom.politicianName]) {
        const dbPol = await prisma.politician.findFirst({
          where: { name: prom.politicianName },
        });
        if (dbPol) politicianIdMap[prom.politicianName] = dbPol.id;
      }
    }

    // Create promises and build a lookup map
    let promisesCreated = 0;
    const promiseIdMap: Record<string, string> = {}; // "politicianName::title" -> promiseId

    for (const prom of promiseRows) {
      const politicianId = politicianIdMap[prom.politicianName];
      if (!politicianId) continue;

      const created = await prisma.promise.create({
        data: {
          title: prom.title,
          description: prom.description,
          category: prom.category,
          status: prom.status as "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED" | "PARTIAL" | "BROKEN",
          dateMade: prom.dateMade,
          sourceUrl: prom.sourceUrl || null,
          weight: prom.weight,
          expectedMonths: prom.expectedMonths,
          politicianId,
        },
      });
      promiseIdMap[`${prom.politicianName}::${prom.title}`] = created.id;
      promisesCreated++;
    }

    // Import status history changes
    let statusChangesCreated = 0;

    // Sort by changedAt so they're processed chronologically
    const sortedHistory = [...statusHistoryRows].sort(
      (a, b) => a.changedAt.getTime() - b.changedAt.getTime()
    );

    for (const sh of sortedHistory) {
      // Find the promise ID
      let promiseId = promiseIdMap[`${sh.politicianName}::${sh.promiseTitle}`];

      if (!promiseId) {
        // Look up in database
        const dbPromise = await prisma.promise.findFirst({
          where: {
            title: sh.promiseTitle,
            politician: { name: sh.politicianName },
          },
        });
        if (dbPromise) promiseId = dbPromise.id;
      }

      if (!promiseId) continue;

      // Check for duplicate (same promiseId + changedAt + newStatus)
      const existing = await prisma.promiseStatusChange.findFirst({
        where: {
          promiseId,
          changedAt: sh.changedAt,
          newStatus: sh.newStatus as "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED" | "PARTIAL" | "BROKEN",
        },
      });

      if (existing) continue;

      await prisma.promiseStatusChange.create({
        data: {
          promiseId,
          oldStatus: sh.oldStatus
            ? (sh.oldStatus as "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED" | "PARTIAL" | "BROKEN")
            : null,
          newStatus: sh.newStatus as "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED" | "PARTIAL" | "BROKEN",
          changedAt: sh.changedAt,
          note: sh.note || null,
        },
      });
      statusChangesCreated++;
    }

    return NextResponse.json({
      success: true,
      summary: {
        politiciansCreated,
        politiciansUpdated,
        promisesCreated,
        statusChangesCreated,
      },
    });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "Failed to process import. Check that the file is a valid .xlsx spreadsheet." },
      { status: 500 }
    );
  }
}

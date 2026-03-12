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
    const clearFirst = formData.get("clearFirst") === "true";

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

      if (name && VALID_COUNTRIES.includes(country) && party && termStart) {
        politicianRows.push({
          name,
          country,
          party,
          photoUrl,
          termStart,
          termEnd,
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
          rowNum,
        });
      }
    }

    // ── Step 3: Check politician name matching ──
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

    // ── Step 4/5: Return errors or import ──
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    // If clearing first, delete all data
    if (clearFirst) {
      await prisma.$transaction([
        prisma.promiseStatusChange.deleteMany(),
        prisma.vote.deleteMany(),
        prisma.donation.deleteMany(),
        prisma.lobbyingRecord.deleteMany(),
        prisma.promise.deleteMany(),
        prisma.bill.deleteMany(),
        prisma.donor.deleteMany(),
        prisma.politician.deleteMany(),
      ]);
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
        await prisma.politician.update({
          where: { id: existing.id },
          data: {
            party: pol.party,
            photoUrl: pol.photoUrl || null,
            termStart: pol.termStart,
            termEnd: pol.termEnd,
          },
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

    // Create promises
    let promisesCreated = 0;
    for (const prom of promiseRows) {
      const politicianId = politicianIdMap[prom.politicianName];
      if (!politicianId) continue;

      await prisma.promise.create({
        data: {
          title: prom.title,
          description: prom.description,
          category: prom.category,
          status: prom.status as "NOT_STARTED" | "IN_PROGRESS" | "FULFILLED" | "PARTIAL" | "BROKEN",
          dateMade: prom.dateMade,
          sourceUrl: prom.sourceUrl || null,
          politicianId,
        },
      });
      promisesCreated++;
    }

    return NextResponse.json({
      success: true,
      summary: {
        politiciansCreated,
        politiciansUpdated,
        promisesCreated,
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

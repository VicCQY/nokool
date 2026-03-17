import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const wb = XLSX.utils.book_new();

  // ── Instructions sheet ──
  const instructions = [
    ["NoKool Data Import Template"],
    [""],
    ["How to use this template:"],
    ["1. Fill in the Politicians sheet with politician data"],
    ["2. Fill in the Promises sheet with promise data"],
    ["3. Optionally fill in the Status History sheet with backdated status changes"],
    ["4. Row 1 contains column headers — do not modify"],
    ["5. Row 2 contains field descriptions — do not modify"],
    ["6. Start entering data from row 3"],
    ["7. The politicianName column in Promises and Status History must exactly match a name in the Politicians sheet"],
    [""],
    ["Valid Countries: US, CA"],
    ["Valid Categories: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other"],
    ["Valid Statuses: NOT_STARTED, IN_PROGRESS, FULFILLED, PARTIAL, BROKEN, REVERSED"],
    [""],
    ["Date format: YYYY-MM-DD (e.g. 2025-01-20)"],
    [""],
    ["Notes:"],
    ["- If a politician with the same name + country already exists, they will be updated"],
    ["- photoUrl and sourceUrl are optional"],
    ["- termEnd is optional (leave blank for current office holders)"],
    ["- inOfficeSince is optional (when they first entered this office, for display)"],
    ["- branch is optional: 'executive' or 'legislative' (default: legislative)"],
    ["- chamber is optional: 'house' or 'senate' (for legislative branch politicians)"],
    ["- state is optional: state code (e.g. NY, TX) — for senators"],
    ["- district is optional: district identifier (e.g. NY-14, KY-4) — for House members"],
  ];
  const instrSheet = XLSX.utils.aoa_to_sheet(instructions);
  instrSheet["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, instrSheet, "Instructions");

  // ── Politicians sheet ──
  const polData = [
    ["name", "country", "party", "photoUrl", "termStart", "termEnd", "inOfficeSince", "branch", "chamber", "state", "district"],
    [
      "Full name of the politician",
      "Country code (US, CA, UK, AU, FR, DE)",
      "Political party name",
      "URL to photo (optional)",
      "Date term started (YYYY-MM-DD)",
      "Date term ends (optional, YYYY-MM-DD)",
      "When they first entered this office (optional, YYYY-MM-DD)",
      "executive or legislative (optional, default: legislative)",
      "house or senate (optional, for legislative branch)",
      "State code (optional, e.g. NY, TX)",
      "District (optional, e.g. NY-14, KY-4)",
    ],
  ];
  const polSheet = XLSX.utils.aoa_to_sheet(polData);
  polSheet["!cols"] = [
    { wch: 25 },
    { wch: 12 },
    { wch: 20 },
    { wch: 40 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 16 },
  ];

  // Add data validation for country column (B3:B1000)
  polSheet["!dataValidation"] = [
    {
      sqref: "B3:B1000",
      type: "list",
      formula1: '"US,CA,UK,AU,FR,DE"',
    },
    {
      sqref: "I3:I1000",
      type: "list",
      formula1: '"executive,legislative"',
    },
    {
      sqref: "J3:J1000",
      type: "list",
      formula1: '"house,senate"',
    },
  ];

  XLSX.utils.book_append_sheet(wb, polSheet, "Politicians");

  // ── Promises sheet ──
  const promData = [
    ["politicianName", "title", "description", "category", "status", "dateMade", "sourceUrl", "weight"],
    [
      "Must match a name in Politicians sheet",
      "Short title of the promise",
      "Detailed description",
      "Category (see Instructions)",
      "Status (NOT_STARTED, IN_PROGRESS, FULFILLED, PARTIAL, BROKEN, REVERSED)",
      "Date promise was made (YYYY-MM-DD)",
      "Source URL (optional)",
      "Severity 1-5 (optional, default 3). 1=Trivial, 3=Standard, 5=Cornerstone",
    ],
  ];
  const promSheet = XLSX.utils.aoa_to_sheet(promData);
  promSheet["!cols"] = [
    { wch: 25 },
    { wch: 35 },
    { wch: 50 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 40 },
    { wch: 12 },
  ];

  promSheet["!dataValidation"] = [
    {
      sqref: "D3:D1000",
      type: "list",
      formula1: '"Economy,Healthcare,Environment,Immigration,Education,Infrastructure,Foreign Policy,Justice,Housing,Technology,Other"',
    },
    {
      sqref: "E3:E1000",
      type: "list",
      formula1: '"NOT_STARTED,IN_PROGRESS,FULFILLED,PARTIAL,BROKEN,REVERSED"',
    },
  ];

  XLSX.utils.book_append_sheet(wb, promSheet, "Promises");

  // ── Status History sheet ──
  const histData = [
    ["politicianName", "promiseTitle", "oldStatus", "newStatus", "changedAt", "note"],
    [
      "Must match a name in Politicians sheet",
      "Must match a promise title in Promises sheet",
      "Previous status (or leave empty for first change)",
      "New status (NOT_STARTED, IN_PROGRESS, FULFILLED, PARTIAL, BROKEN, REVERSED)",
      "Date of the change (YYYY-MM-DD)",
      "Optional note explaining the change",
    ],
    [
      "John Smith",
      "Build 100 new schools",
      "",
      "NOT_STARTED",
      "2025-01-20",
      "Promise made during inauguration",
    ],
    [
      "John Smith",
      "Build 100 new schools",
      "NOT_STARTED",
      "IN_PROGRESS",
      "2025-06-15",
      "Signed education funding bill",
    ],
  ];
  const histSheet = XLSX.utils.aoa_to_sheet(histData);
  histSheet["!cols"] = [
    { wch: 25 },
    { wch: 35 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 45 },
  ];

  histSheet["!dataValidation"] = [
    {
      sqref: "C3:C1000",
      type: "list",
      formula1: '"NOT_STARTED,IN_PROGRESS,FULFILLED,PARTIAL,BROKEN,REVERSED"',
    },
    {
      sqref: "D3:D1000",
      type: "list",
      formula1: '"NOT_STARTED,IN_PROGRESS,FULFILLED,PARTIAL,BROKEN,REVERSED"',
    },
  ];

  XLSX.utils.book_append_sheet(wb, histSheet, "Status History");

  // Generate buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="NoKool-Data-Template.xlsx"',
    },
  });
}

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
    ["3. Row 1 contains column headers — do not modify"],
    ["4. Row 2 contains field descriptions — do not modify"],
    ["5. Start entering data from row 3"],
    ["6. The politicianName column in Promises must exactly match a name in the Politicians sheet"],
    [""],
    ["Valid Countries: US, CA, UK, AU, FR, DE"],
    ["Valid Categories: Economy, Healthcare, Environment, Immigration, Education, Infrastructure, Foreign Policy, Justice, Housing, Technology, Other"],
    ["Valid Statuses: NOT_STARTED, IN_PROGRESS, FULFILLED, PARTIAL, BROKEN"],
    [""],
    ["Date format: YYYY-MM-DD (e.g. 2025-01-20)"],
    [""],
    ["Notes:"],
    ["- If a politician with the same name + country already exists, they will be updated"],
    ["- photoUrl and sourceUrl are optional"],
    ["- termEnd is optional (leave blank for current office holders)"],
  ];
  const instrSheet = XLSX.utils.aoa_to_sheet(instructions);
  instrSheet["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, instrSheet, "Instructions");

  // ── Politicians sheet ──
  const polData = [
    ["name", "country", "party", "photoUrl", "termStart", "termEnd"],
    [
      "Full name of the politician",
      "Country code (US, CA, UK, AU, FR, DE)",
      "Political party name",
      "URL to photo (optional)",
      "Date term started (YYYY-MM-DD)",
      "Date term ends (optional, YYYY-MM-DD)",
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
  ];

  // Add data validation for country column (B3:B1000)
  polSheet["!dataValidation"] = [
    {
      sqref: "B3:B1000",
      type: "list",
      formula1: '"US,CA,UK,AU,FR,DE"',
    },
  ];

  XLSX.utils.book_append_sheet(wb, polSheet, "Politicians");

  // ── Promises sheet ──
  const promData = [
    ["politicianName", "title", "description", "category", "status", "dateMade", "sourceUrl"],
    [
      "Must match a name in Politicians sheet",
      "Short title of the promise",
      "Detailed description",
      "Category (see Instructions)",
      "Status (NOT_STARTED, IN_PROGRESS, FULFILLED, PARTIAL, BROKEN)",
      "Date promise was made (YYYY-MM-DD)",
      "Source URL (optional)",
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
      formula1: '"NOT_STARTED,IN_PROGRESS,FULFILLED,PARTIAL,BROKEN"',
    },
  ];

  XLSX.utils.book_append_sheet(wb, promSheet, "Promises");

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

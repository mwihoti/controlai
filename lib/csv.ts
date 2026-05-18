import type { WorkerSignal } from "./types.ts";

const CSV_HEADERS: Array<keyof WorkerSignal> = [
  "id",
  "name",
  "team",
  "role",
  "location",
  "manager",
  "timezone",
  "prsOpenedLast14Days",
  "reviewLatencyHours",
  "afterHoursWorkPct",
  "meetingLoadHours",
  "focusHoursPerDay",
  "onCallPagesLast14Days",
  "manager1to1GapDays",
  "vacationDaysNext30",
  "asyncSentimentScore",
  "note"
];

const HEADER_MAP: Record<string, keyof WorkerSignal> = {
  id: "id",
  name: "name",
  team: "team",
  role: "role",
  location: "location",
  manager: "manager",
  timezone: "timezone",
  prsopenedlast14days: "prsOpenedLast14Days",
  reviewlatencyhours: "reviewLatencyHours",
  afterhoursworkpct: "afterHoursWorkPct",
  meetingloadhours: "meetingLoadHours",
  focushoursperday: "focusHoursPerDay",
  oncallpageslast14days: "onCallPagesLast14Days",
  manager1to1gapdays: "manager1to1GapDays",
  vacationdaysnext30: "vacationDaysNext30",
  asyncsentimentscore: "asyncSentimentScore",
  note: "note"
};

const NUMERIC_FIELDS: Array<keyof WorkerSignal> = [
  "prsOpenedLast14Days",
  "reviewLatencyHours",
  "afterHoursWorkPct",
  "meetingLoadHours",
  "focusHoursPerDay",
  "onCallPagesLast14Days",
  "manager1to1GapDays",
  "vacationDaysNext30",
  "asyncSentimentScore"
];

function normalizeHeader(header: string) {
  return header.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function escapeCsvValue(value: string | number) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function parseWorkerCsv(input: string): WorkerSignal[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const mappedHeaders = headers.map((header) => HEADER_MAP[header]);

  if (mappedHeaders.some((value) => !value)) {
    const badHeaders = headers.filter((_, index) => !mappedHeaders[index]);
    throw new Error(`Unsupported CSV columns: ${badHeaders.join(", ")}`);
  }

  return lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line);
    const record = {} as WorkerSignal;

    mappedHeaders.forEach((field, index) => {
      const key = field as keyof WorkerSignal;
      const rawValue = values[index] ?? "";

      if (NUMERIC_FIELDS.includes(key)) {
        const parsedNumber = Number(rawValue);
        if (Number.isNaN(parsedNumber)) {
          throw new Error(`Invalid numeric value for ${String(key)} on row ${rowIndex + 2}.`);
        }
        record[key] = parsedNumber as never;
      } else {
        record[key] = rawValue as never;
      }
    });

    return validateWorkerSignal(record, rowIndex + 2);
  });
}

export function validateWorkerSignal(record: WorkerSignal, rowLabel?: number): WorkerSignal {
  const requiredStrings: Array<keyof WorkerSignal> = [
    "id",
    "name",
    "team",
    "role",
    "location",
    "manager",
    "timezone",
    "note"
  ];

  for (const key of requiredStrings) {
    if (!String(record[key] ?? "").trim()) {
      throw new Error(`Missing required field "${String(key)}"${rowLabel ? ` on row ${rowLabel}` : ""}.`);
    }
  }

  for (const key of NUMERIC_FIELDS) {
    const value = Number(record[key]);
    if (Number.isNaN(value)) {
      throw new Error(`Invalid numeric field "${String(key)}"${rowLabel ? ` on row ${rowLabel}` : ""}.`);
    }
  }

  return record;
}

export function serializeWorkerCsv(workers: WorkerSignal[]) {
  const rows = workers.map((worker) =>
    CSV_HEADERS.map((header) => escapeCsvValue(worker[header])).join(",")
  );

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export const sampleCsvTemplate = [
  "id,name,team,role,location,manager,timezone,prsOpenedLast14Days,reviewLatencyHours,afterHoursWorkPct,meetingLoadHours,focusHoursPerDay,onCallPagesLast14Days,manager1to1GapDays,vacationDaysNext30,asyncSentimentScore,note",
  'svc_checkout,Checkout API,Commerce Platform,Tier 1 Revenue Service,us-east-1,Maya Johnson,production,8,26,37,14,2.7,4,36,3,2.2,"Stale PR queue, failed deploys, and repeated payment alert escalations are threatening the release window."',
  'svc_ledger,Ledger Sync,Finance Systems,Critical Data Pipeline,us-central-1,Rafael Kim,production,2,7,10,5,5.2,1,8,0,4.3,"Healthy release lane with low alert noise and clear ownership."'
].join("\n");

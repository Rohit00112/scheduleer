import Excel from "exceljs";
import {
  excelSerialToDate,
  normalizeNumericString,
  normalizeWhitespace,
  parseDayToIndex,
  splitGroupTokens,
  toMinutesFromExcelFraction,
  toMinutesFromRange
} from "./normalizers";
import { detectConflicts } from "./conflicts";
import type {
  ExceptionSessionInput,
  ParseWorkbookResult,
  ParsedIssue,
  WeeklySessionInput
} from "./types";

const DAYS = new Set(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);

const MODULE_VIEW_HEADERS = [
  "Day",
  "Time Start",
  "Time End",
  "Hours",
  "Class Type",
  "Year",
  "Course",
  "Specialization",
  "Module Code",
  "Module Title",
  "Lecturer",
  "Group",
  "Block",
  "Level",
  "Room"
];

const FALLBACK_HEADERS = [
  "Day",
  "Time",
  "Class Type",
  "Year",
  "Module Code",
  "Module Title",
  "Lecturer",
  "Group",
  "Block",
  "Level",
  "Room"
];

const WEEK0_HEADERS = ["Day", "Time", "Class Type", "Module Title", "Facilitators", "Block", "Level", "Room"];

function resolveCellValue(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "formula" in (value as Record<string, unknown>) &&
    "result" in (value as Record<string, unknown>)
  ) {
    return resolveCellValue((value as { result: unknown }).result);
  }

  return value;
}

function cellValueToText(value: unknown): string {
  const resolved = resolveCellValue(value);

  if (resolved === null || resolved === undefined) {
    return "";
  }

  if (resolved instanceof Date) {
    return resolved.toISOString().slice(0, 10);
  }

  if (typeof resolved === "object") {
    if ("richText" in (resolved as Record<string, unknown>)) {
      const richText = (resolved as { richText?: Array<{ text: string }> }).richText ?? [];
      return richText.map((item) => item.text).join("");
    }

    if ("text" in (resolved as Record<string, unknown>)) {
      return String((resolved as { text?: unknown }).text ?? "");
    }

    if ("hyperlink" in (resolved as Record<string, unknown>) && "text" in (resolved as Record<string, unknown>)) {
      return String((resolved as { text?: unknown }).text ?? "");
    }
  }

  return String(resolved);
}

function cellValueToNumber(value: unknown): number | null {
  const resolved = resolveCellValue(value);
  if (typeof resolved === "number") {
    return Number.isNaN(resolved) ? null : resolved;
  }

  if (resolved instanceof Date) {
    return null;
  }

  const num = Number(cellValueToText(resolved));
  return Number.isNaN(num) ? null : num;
}

function cellValueToMinuteFromTime(value: unknown): number | null {
  const resolved = resolveCellValue(value);
  if (resolved instanceof Date) {
    return resolved.getUTCHours() * 60 + resolved.getUTCMinutes();
  }

  const numeric = cellValueToNumber(resolved);
  if (numeric === null) {
    return null;
  }

  return toMinutesFromExcelFraction(numeric);
}

function normalizeHeader(value: unknown): string {
  return cellValueToText(value).trim().toLowerCase();
}

function rowValues(row: Excel.Row): unknown[] {
  return (row.values as unknown[]).slice(1);
}

function hasHeader(row: Excel.Row, expected: string[]): boolean {
  const values = rowValues(row).map(normalizeHeader);
  return expected.every((field, idx) => values[idx] === field.toLowerCase());
}

function addIssue(
  issues: ParsedIssue[],
  severity: ParsedIssue["severity"],
  message: string,
  sourceSheet?: string,
  sourceRow?: number,
  type: ParsedIssue["type"] = "invalid",
  entityKey = "parse"
): void {
  issues.push({
    severity,
    message,
    sourceSheet,
    sourceRow,
    type,
    entityKey
  });
}

function validateSessionTime(
  startMinute: number | null,
  endMinute: number | null,
  issues: ParsedIssue[],
  sourceSheet: string,
  sourceRow: number
): startMinute is number {
  if (startMinute === null || endMinute === null) {
    addIssue(issues, "error", "Unparseable day/time value.", sourceSheet, sourceRow, "invalid", "time");
    return false;
  }

  if (endMinute <= startMinute) {
    addIssue(
      issues,
      "error",
      "End time must be greater than start time.",
      sourceSheet,
      sourceRow,
      "invalid",
      "time-order"
    );
    return false;
  }

  return true;
}

function parseModuleViewSheet(
  sheet: Excel.Worksheet,
  issues: ParsedIssue[]
): { weekly: WeeklySessionInput[]; exceptions: ExceptionSessionInput[] } {
  const weekly: WeeklySessionInput[] = [];
  const exceptions: ExceptionSessionInput[] = [];

  const headerRow = sheet.getRow(1);
  if (!hasHeader(headerRow, MODULE_VIEW_HEADERS)) {
    addIssue(issues, "warning", "Module View sheet exists but header was not recognized.", sheet.name, 1);
    return { weekly, exceptions };
  }

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const dayValue = resolveCellValue(row.getCell(1).value);
    if (dayValue === null || dayValue === undefined || String(dayValue).trim() === "") {
      continue;
    }

    const dayText = normalizeWhitespace(cellValueToText(dayValue));
    if (!dayText || !DAYS.has(dayText)) {
      continue;
    }

    const weeklyDay = parseDayToIndex(dayText);
    const startMinute = cellValueToMinuteFromTime(row.getCell(2).value);
    const endMinute = cellValueToMinuteFromTime(row.getCell(3).value);

    if (weeklyDay === null) {
      addIssue(issues, "error", "Unknown day in Module View.", sheet.name, rowNumber, "invalid", "day");
      continue;
    }

    if (!validateSessionTime(startMinute, endMinute, issues, sheet.name, rowNumber)) {
      continue;
    }

    const roomName = normalizeWhitespace(cellValueToText(row.getCell(15).value));
    if (!roomName) {
      addIssue(issues, "error", "Missing room value.", sheet.name, rowNumber, "invalid", "room");
      continue;
    }

    const classType = normalizeWhitespace(cellValueToText(row.getCell(5).value) || "Unknown") ?? "Unknown";
    if (!["Lecture", "Tutorial", "Workshop"].includes(classType)) {
      addIssue(
        issues,
        "warning",
        `Unknown class type: ${classType}`,
        sheet.name,
        rowNumber,
        "invalid",
        "class-type"
      );
    }

    const groupLabel = normalizeWhitespace(cellValueToText(row.getCell(12).value));

    weekly.push({
      weeklyDay,
      startMinute,
      endMinute: endMinute!,
      classType,
      yearLevel: normalizeNumericString(cellValueToText(row.getCell(6).value)),
      courseCode: normalizeWhitespace(cellValueToText(row.getCell(7).value)),
      specialization: normalizeWhitespace(cellValueToText(row.getCell(8).value)),
      moduleCode: normalizeWhitespace(cellValueToText(row.getCell(9).value))?.toUpperCase() ?? null,
      moduleTitle: normalizeWhitespace(cellValueToText(row.getCell(10).value)),
      lecturerName: normalizeWhitespace(cellValueToText(row.getCell(11).value)),
      groupLabel,
      groupTokens: splitGroupTokens(groupLabel),
      block: normalizeWhitespace(cellValueToText(row.getCell(13).value)),
      level: normalizeNumericString(cellValueToText(row.getCell(14).value)),
      roomName,
      sourceSheet: sheet.name,
      sourceRow: rowNumber
    });
  }

  return { weekly, exceptions };
}

function parseFallbackSection(
  sheet: Excel.Worksheet,
  startRow: number,
  issues: ParsedIssue[],
  options: { parseWeekly: boolean; parseExceptions: boolean }
): { weekly: WeeklySessionInput[]; exceptions: ExceptionSessionInput[]; nextRow: number } {
  const weekly: WeeklySessionInput[] = [];
  const exceptions: ExceptionSessionInput[] = [];
  const header = sheet.getRow(startRow);

  const isWeek0 = hasHeader(header, WEEK0_HEADERS);
  const isFallback = hasHeader(header, FALLBACK_HEADERS);

  if (!isWeek0 && !isFallback) {
    return { weekly, exceptions, nextRow: startRow + 1 };
  }

  if (isFallback && !options.parseWeekly) {
    let rowNumber = startRow + 1;
    while (rowNumber <= sheet.rowCount) {
      const row = sheet.getRow(rowNumber);
      if (hasHeader(row, FALLBACK_HEADERS) || hasHeader(row, WEEK0_HEADERS)) {
        break;
      }
      rowNumber += 1;
    }

    return { weekly, exceptions, nextRow: rowNumber };
  }

  let rowNumber = startRow + 1;
  while (rowNumber <= sheet.rowCount) {
    const row = sheet.getRow(rowNumber);

    if (hasHeader(row, FALLBACK_HEADERS) || hasHeader(row, WEEK0_HEADERS)) {
      break;
    }

    const dayRaw = resolveCellValue(row.getCell(1).value);
    const timeRaw = cellValueToText(row.getCell(2).value);
    const roomRaw = cellValueToText(row.getCell(isWeek0 ? 8 : 11).value);
    if (!dayRaw && !timeRaw && !roomRaw) {
      rowNumber += 1;
      continue;
    }

    const timeRange = toMinutesFromRange(timeRaw);
    if (!timeRange) {
      const dayIndex = parseDayToIndex(dayRaw);
      const dayNumeric = cellValueToNumber(dayRaw);
      if (!(dayRaw instanceof Date) && dayIndex === null && dayNumeric === null) {
        rowNumber += 1;
        continue;
      }

      addIssue(issues, "error", "Invalid time range format.", sheet.name, rowNumber, "invalid", "time-range");
      rowNumber += 1;
      continue;
    }

    const roomName = normalizeWhitespace(roomRaw);
    if (!roomName) {
      addIssue(issues, "error", "Missing room in fallback section.", sheet.name, rowNumber, "invalid", "room");
      rowNumber += 1;
      continue;
    }

    const classType = normalizeWhitespace(cellValueToText(row.getCell(3).value) || "Unknown") ?? "Unknown";
    if (!["Lecture", "Tutorial", "Workshop", "Briefing", "Activity", "Presentation"].includes(classType)) {
      addIssue(issues, "warning", `Unknown class type: ${classType}`, sheet.name, rowNumber, "invalid", "class-type");
    }

    if (isWeek0) {
      if (!options.parseExceptions) {
        rowNumber += 1;
        continue;
      }

      let occurrenceDate: string | null = null;
      let weeklyDay: number | null = null;

      if (dayRaw instanceof Date) {
        occurrenceDate = dayRaw.toISOString().slice(0, 10);
        weeklyDay = dayRaw.getUTCDay();
      } else {
        const dayNumeric = cellValueToNumber(dayRaw);
        if (dayNumeric !== null) {
          try {
            occurrenceDate = excelSerialToDate(dayNumeric);
            weeklyDay = parseDayToIndex(dayNumeric);
          } catch {
            occurrenceDate = null;
            weeklyDay = null;
          }
        }
      }

      if (!occurrenceDate || weeklyDay === null) {
        addIssue(issues, "error", "Invalid day serial for date exception.", sheet.name, rowNumber, "invalid", "day");
        rowNumber += 1;
        continue;
      }

      const groupLabel: string | null = null;
      exceptions.push({
        occurrenceDate,
        weeklyDay,
        startMinute: timeRange.start,
        endMinute: timeRange.end,
        classType,
        moduleCode: null,
        moduleTitle: normalizeWhitespace(cellValueToText(row.getCell(4).value)),
        lecturerName: normalizeWhitespace(cellValueToText(row.getCell(5).value)),
        groupLabel,
        groupTokens: [],
        block: normalizeWhitespace(cellValueToText(row.getCell(6).value)),
        level: normalizeNumericString(cellValueToText(row.getCell(7).value)),
        roomName,
        sourceSheet: sheet.name,
        sourceRow: rowNumber
      });

      rowNumber += 1;
      continue;
    }

    const dayText = normalizeWhitespace(cellValueToText(dayRaw));
    const weeklyDay = parseDayToIndex(dayText);
    if (weeklyDay === null) {
      rowNumber += 1;
      continue;
    }

    const groupLabel = normalizeWhitespace(cellValueToText(row.getCell(8).value));

    if (!options.parseWeekly) {
      rowNumber += 1;
      continue;
    }

    weekly.push({
      weeklyDay,
      startMinute: timeRange.start,
      endMinute: timeRange.end,
      classType,
      yearLevel: normalizeNumericString(cellValueToText(row.getCell(4).value)),
      courseCode: null,
      specialization: null,
      moduleCode: normalizeWhitespace(cellValueToText(row.getCell(5).value))?.toUpperCase() ?? null,
      moduleTitle: normalizeWhitespace(cellValueToText(row.getCell(6).value)),
      lecturerName: normalizeWhitespace(cellValueToText(row.getCell(7).value)),
      groupLabel,
      groupTokens: splitGroupTokens(groupLabel),
      block: normalizeWhitespace(cellValueToText(row.getCell(9).value)),
      level: normalizeNumericString(cellValueToText(row.getCell(10).value)),
      roomName,
      sourceSheet: sheet.name,
      sourceRow: rowNumber
    });

    rowNumber += 1;
  }

  return { weekly, exceptions, nextRow: rowNumber };
}

export async function parseWorkbook(buffer: Buffer): Promise<ParseWorkbookResult> {
  const workbook = new Excel.Workbook();
  const xlsxReader = workbook.xlsx as unknown as { load: (content: unknown) => Promise<void> };
  await xlsxReader.load(buffer);

  const issues: ParsedIssue[] = [];
  const weeklySessions: WeeklySessionInput[] = [];
  const exceptionSessions: ExceptionSessionInput[] = [];

  const moduleView = workbook.getWorksheet("Module View");
  let sourceMode: ParseWorkbookResult["summary"]["sourceMode"] = "fallback-headers";

  if (moduleView) {
    const result = parseModuleViewSheet(moduleView, issues);
    weeklySessions.push(...result.weekly);
    exceptionSessions.push(...result.exceptions);
    if (result.weekly.length > 0) {
      sourceMode = "module-view";
    }
  }

  const hasCanonicalWeekly = weeklySessions.length > 0;

  for (const sheet of workbook.worksheets) {
    if (sheet.name === "Module View" || sheet.name === "Workload" || sheet.name === "Data") {
      continue;
    }

    let rowNumber = 1;
    while (rowNumber <= sheet.rowCount) {
      const section = parseFallbackSection(sheet, rowNumber, issues, {
        parseWeekly: !hasCanonicalWeekly,
        parseExceptions: true
      });
      rowNumber = section.nextRow;
      if (section.weekly.length > 0 || section.exceptions.length > 0) {
        weeklySessions.push(...section.weekly);
        exceptionSessions.push(...section.exceptions);
        if (sourceMode === "module-view") {
          sourceMode = "mixed";
        } else if (sourceMode !== "mixed") {
          sourceMode = "fallback-headers";
        }
      }
    }
  }

  const dedupeSet = new Set<string>();
  const dedupedWeekly: WeeklySessionInput[] = [];
  for (const session of weeklySessions) {
    const key = [
      session.weeklyDay,
      session.startMinute,
      session.endMinute,
      session.moduleCode,
      session.lecturerName,
      session.roomName,
      session.groupLabel
    ].join("|");

    if (dedupeSet.has(key)) {
      addIssue(
        issues,
        "warning",
        "Duplicate row fingerprint detected.",
        session.sourceSheet,
        session.sourceRow,
        "invalid",
        "duplicate"
      );
      continue;
    }

    dedupeSet.add(key);
    dedupedWeekly.push(session);
  }

  const conflictIssues = detectConflicts(dedupedWeekly, exceptionSessions);
  issues.push(...conflictIssues);

  if (exceptionSessions.some((session) => !session.moduleCode)) {
    addIssue(
      issues,
      "warning",
      "Exception rows without module code were detected.",
      "Week 0",
      undefined,
      "invalid",
      "module-code"
    );
  }

  return {
    weeklySessions: dedupedWeekly,
    exceptionSessions,
    issues,
    summary: {
      weeklyCount: dedupedWeekly.length,
      exceptionCount: exceptionSessions.length,
      warningCount: issues.filter((issue) => issue.severity === "warning").length,
      errorCount: issues.filter((issue) => issue.severity === "error").length,
      sourceMode
    }
  };
}

export * from "./types";
export * from "./normalizers";

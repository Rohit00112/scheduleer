const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

export function normalizeWhitespace(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeNumericString(value: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const n = Number(normalized);
  if (Number.isNaN(n)) {
    return normalized;
  }

  return Number.isInteger(n) ? String(n) : String(n);
}

export function toMinutesFromExcelFraction(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) {
    return null;
  }

  const minute = Math.round(n * 24 * 60);
  if (minute < 0 || minute > 24 * 60) {
    return null;
  }

  return minute;
}

export function toMinutesFromRange(value: string): { start: number; end: number } | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split("-").map((part) => part.trim());
  if (parts.length !== 2) {
    return null;
  }

  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null) {
    return null;
  }

  return { start, end };
}

export function parseTimeToMinutes(value: string): number | null {
  const normalized = normalizeWhitespace(value)?.toUpperCase();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3];

  if (hour < 1 || hour > 12 || minute < 0 || minute >= 60) {
    return null;
  }

  if (meridiem === "AM") {
    hour = hour === 12 ? 0 : hour;
  } else {
    hour = hour === 12 ? 12 : hour + 12;
  }

  return hour * 60 + minute;
}

export function parseDayToIndex(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getUTCDay();
  }

  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value ?? ""))) {
    const serial = Number(value);
    if (Number.isNaN(serial)) {
      return null;
    }

    // Excel serial date base 1899-12-30
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(epoch.getTime() + Math.floor(serial) * 24 * 60 * 60 * 1000);
    return date.getUTCDay();
  }

  const normalized = normalizeWhitespace(String(value))?.toLowerCase();
  if (!normalized) {
    return null;
  }

  const idx = DAYS.indexOf(normalized);
  return idx >= 0 ? idx : null;
}

export function excelSerialToDate(value: number): string {
  if (!Number.isFinite(value) || value < 1 || value > 300000) {
    throw new Error(`Invalid excel serial date value: ${value}`);
  }

  const epoch = new Date(Date.UTC(1899, 11, 30));
  const date = new Date(epoch.getTime() + Math.floor(value) * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function splitGroupTokens(groupLabel: string | null): string[] {
  if (!groupLabel) {
    return [];
  }

  return groupLabel
    .split("+")
    .map((part) => normalizeWhitespace(part))
    .filter((v): v is string => Boolean(v));
}

export function dayLabelFromIndex(day: number): string {
  return DAYS[day] ?? `day-${day}`;
}

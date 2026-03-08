export function minuteToTime(minute: number): string {
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

export function parseTimeToMinute(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

export function weekdayFromDate(date: string): number {
  return new Date(`${date}T00:00:00+05:45`).getDay();
}

export function normalizeDate(date?: string): string {
  if (date) {
    return date;
  }
  return new Date().toISOString().slice(0, 10);
}

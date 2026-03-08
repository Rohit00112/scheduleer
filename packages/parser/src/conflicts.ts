import { dayLabelFromIndex } from "./normalizers";
import type {
  ExceptionSessionInput,
  ParsedIssue,
  WeeklySessionInput
} from "./types";

interface BaseSlot {
  keyPrefix: string;
  startMinute: number;
  endMinute: number;
  roomName: string;
  lecturerName: string | null;
  groupTokens: string[];
  groupScope: string;
  sourceSheet: string;
  sourceRow: number;
}

function pushConflict(
  issues: ParsedIssue[],
  type: ParsedIssue["type"],
  key: string,
  sourceSheet: string,
  sourceRow: number,
  detail: string
): void {
  issues.push({
    type,
    severity: "error",
    entityKey: key,
    sourceSheet,
    sourceRow,
    message: detail
  });
}

function detectSlotConflicts(slots: BaseSlot[]): ParsedIssue[] {
  const issues: ParsedIssue[] = [];
  const roomMap = new Map<string, BaseSlot[]>();
  const lecturerMap = new Map<string, BaseSlot[]>();
  const groupMap = new Map<string, BaseSlot[]>();

  for (const slot of slots) {
    const slotKey = `${slot.keyPrefix}|${slot.startMinute}|${slot.endMinute}`;

    const roomKey = `${slotKey}|room|${slot.roomName.toLowerCase()}`;
    roomMap.set(roomKey, [...(roomMap.get(roomKey) ?? []), slot]);

    if (slot.lecturerName) {
      const lecturerKey = `${slotKey}|lecturer|${slot.lecturerName.toLowerCase()}`;
      lecturerMap.set(lecturerKey, [...(lecturerMap.get(lecturerKey) ?? []), slot]);
    }

    for (const group of slot.groupTokens) {
      const groupKey = `${slotKey}|group|${slot.groupScope}|${group.toLowerCase()}`;
      groupMap.set(groupKey, [...(groupMap.get(groupKey) ?? []), slot]);
    }
  }

  for (const [key, items] of roomMap.entries()) {
    if (items.length > 1) {
      for (const item of items) {
        pushConflict(issues, "room", key, item.sourceSheet, item.sourceRow, "Room conflict at the same timeslot.");
      }
    }
  }

  for (const [key, items] of lecturerMap.entries()) {
    if (items.length > 1) {
      for (const item of items) {
        pushConflict(
          issues,
          "lecturer",
          key,
          item.sourceSheet,
          item.sourceRow,
          "Lecturer conflict at the same timeslot."
        );
      }
    }
  }

  for (const [key, items] of groupMap.entries()) {
    if (items.length > 1) {
      for (const item of items) {
        pushConflict(issues, "group", key, item.sourceSheet, item.sourceRow, "Group conflict at the same timeslot.");
      }
    }
  }

  return issues;
}

export function detectConflicts(
  weekly: WeeklySessionInput[],
  exceptions: ExceptionSessionInput[]
): ParsedIssue[] {
  const weeklySlots: BaseSlot[] = weekly.map((session) => ({
    keyPrefix: `weekly:${dayLabelFromIndex(session.weeklyDay)}`,
    startMinute: session.startMinute,
    endMinute: session.endMinute,
    roomName: session.roomName,
    lecturerName: session.lecturerName,
    groupTokens: session.groupTokens,
    groupScope: `${session.courseCode ?? ""}|${session.yearLevel ?? ""}|${session.specialization ?? ""}`.toLowerCase(),
    sourceSheet: session.sourceSheet,
    sourceRow: session.sourceRow
  }));

  const exceptionSlots: BaseSlot[] = exceptions.map((session) => ({
    keyPrefix: `date:${session.occurrenceDate}`,
    startMinute: session.startMinute,
    endMinute: session.endMinute,
    roomName: session.roomName,
    lecturerName: session.lecturerName,
    groupTokens: session.groupTokens,
    groupScope: "",
    sourceSheet: session.sourceSheet,
    sourceRow: session.sourceRow
  }));

  return [...detectSlotConflicts(weeklySlots), ...detectSlotConflicts(exceptionSlots)];
}

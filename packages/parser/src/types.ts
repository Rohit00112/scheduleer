export type ParsedSeverity = "error" | "warning";
export type ParsedConflictType = "room" | "lecturer" | "group" | "overlap" | "invalid";

export interface ParsedIssue {
  type: ParsedConflictType;
  severity: ParsedSeverity;
  message: string;
  entityKey: string;
  sourceSheet?: string;
  sourceRow?: number;
  details?: Record<string, unknown>;
}

export interface WeeklySessionInput {
  weeklyDay: number;
  startMinute: number;
  endMinute: number;
  classType: string;
  yearLevel: string | null;
  courseCode: string | null;
  specialization: string | null;
  moduleCode: string | null;
  moduleTitle: string | null;
  lecturerName: string | null;
  groupLabel: string | null;
  groupTokens: string[];
  block: string | null;
  level: string | null;
  roomName: string;
  sourceSheet: string;
  sourceRow: number;
}

export interface ExceptionSessionInput {
  occurrenceDate: string;
  weeklyDay: number;
  startMinute: number;
  endMinute: number;
  classType: string;
  moduleCode: string | null;
  moduleTitle: string | null;
  lecturerName: string | null;
  groupLabel: string | null;
  groupTokens: string[];
  block: string | null;
  level: string | null;
  roomName: string;
  sourceSheet: string;
  sourceRow: number;
}

export interface ParseWorkbookResult {
  weeklySessions: WeeklySessionInput[];
  exceptionSessions: ExceptionSessionInput[];
  issues: ParsedIssue[];
  summary: {
    weeklyCount: number;
    exceptionCount: number;
    warningCount: number;
    errorCount: number;
    sourceMode: "module-view" | "fallback-headers" | "mixed";
  };
}

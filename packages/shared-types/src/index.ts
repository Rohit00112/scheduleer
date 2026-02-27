import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "staff", "viewer"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const ScheduleVersionStatusSchema = z.enum([
  "draft",
  "validated",
  "active",
  "archived",
  "failed"
]);
export type ScheduleVersionStatus = z.infer<typeof ScheduleVersionStatusSchema>;

export const ConflictSeveritySchema = z.enum(["error", "warning"]);
export type ConflictSeverity = z.infer<typeof ConflictSeveritySchema>;

export const ConflictTypeSchema = z.enum([
  "room",
  "lecturer",
  "group",
  "overlap",
  "invalid"
]);
export type ConflictType = z.infer<typeof ConflictTypeSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string()
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const SessionViewSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  weeklyDay: z.number().min(0).max(6).optional(),
  startMinute: z.number().min(0).max(1440),
  endMinute: z.number().min(0).max(1440),
  classType: z.string(),
  moduleCode: z.string().nullable(),
  moduleTitle: z.string().nullable(),
  lecturerName: z.string().nullable(),
  roomName: z.string(),
  block: z.string().nullable(),
  level: z.string().nullable(),
  groups: z.array(z.string())
});
export type SessionView = z.infer<typeof SessionViewSchema>;

export const RoomAvailabilityItemSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  isAvailable: z.boolean(),
  conflicts: z.array(SessionViewSchema)
});
export type RoomAvailabilityItem = z.infer<typeof RoomAvailabilityItemSchema>;

export const RealtimeImportProgressSchema = z.object({
  importJobId: z.string(),
  versionId: z.string(),
  percent: z.number(),
  phase: z.string()
});
export type RealtimeImportProgress = z.infer<typeof RealtimeImportProgressSchema>;

export const RealtimeImportCompletedSchema = z.object({
  importJobId: z.string(),
  versionId: z.string(),
  status: z.string(),
  counts: z.record(z.string(), z.number())
});
export type RealtimeImportCompleted = z.infer<typeof RealtimeImportCompletedSchema>;

export const RealtimeScheduleActivatedSchema = z.object({
  versionId: z.string(),
  termId: z.string(),
  activatedAt: z.string()
});
export type RealtimeScheduleActivated = z.infer<typeof RealtimeScheduleActivatedSchema>;

export const RealtimeRoomStatusUpdatedSchema = z.object({
  date: z.string(),
  roomId: z.string(),
  busySlots: z.array(z.object({ startMinute: z.number(), endMinute: z.number() })),
  freeSlots: z.array(z.object({ startMinute: z.number(), endMinute: z.number() }))
});
export type RealtimeRoomStatusUpdated = z.infer<typeof RealtimeRoomStatusUpdatedSchema>;

export const RealtimeBoardUpdatedSchema = z.object({
  versionId: z.string(),
  date: z.string(),
  scope: z.enum(["all", "mine"])
});
export type RealtimeBoardUpdated = z.infer<typeof RealtimeBoardUpdatedSchema>;

export const RealtimeNotificationCreatedSchema = z.object({
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  notificationId: z.string()
});
export type RealtimeNotificationCreated = z.infer<typeof RealtimeNotificationCreatedSchema>;

export const RealtimeAnalyticsRefreshedSchema = z.object({
  generatedAt: z.string(),
  type: z.string().optional()
});
export type RealtimeAnalyticsRefreshed = z.infer<typeof RealtimeAnalyticsRefreshedSchema>;

export const BoardTimeslotSchema = z.object({
  id: z.string(),
  startMinute: z.number(),
  label: z.string()
});
export type BoardTimeslot = z.infer<typeof BoardTimeslotSchema>;

export const BoardRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  block: z.string().nullable(),
  level: z.string().nullable()
});
export type BoardRoom = z.infer<typeof BoardRoomSchema>;

export const BoardCellSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  roomName: z.string(),
  rowStart: z.number(),
  rowSpan: z.number(),
  startMinute: z.number(),
  endMinute: z.number(),
  start: z.string(),
  end: z.string(),
  classType: z.string(),
  moduleCode: z.string().nullable(),
  moduleTitle: z.string().nullable(),
  lecturerName: z.string().nullable(),
  groups: z.array(z.string()),
  block: z.string().nullable(),
  level: z.string().nullable(),
  dayType: z.enum(["weekly", "exception"]),
  occurrenceDate: z.string().nullable(),
  sourceSheet: z.string(),
  sourceRow: z.number(),
  conflictFlags: z.object({
    room: z.boolean(),
    lecturer: z.boolean(),
    group: z.boolean()
  })
});
export type BoardCell = z.infer<typeof BoardCellSchema>;

export const BoardWeeklyResponseSchema = z.object({
  date: z.string(),
  weeklyDay: z.number(),
  scope: z.enum(["all", "mine"]),
  versionId: z.string(),
  rooms: z.array(BoardRoomSchema),
  timeslots: z.array(BoardTimeslotSchema),
  cells: z.array(BoardCellSchema),
  legend: z.record(z.string(), z.string()),
  summary: z.object({
    sessionCount: z.number(),
    roomCount: z.number(),
    timeslotCount: z.number(),
    exceptionCount: z.number(),
    conflictCount: z.number()
  })
});
export type BoardWeeklyResponse = z.infer<typeof BoardWeeklyResponseSchema>;

export const CreateUserLecturerMappingDtoSchema = z.object({
  userId: z.string().uuid(),
  lecturerId: z.string().uuid(),
  isPrimary: z.boolean().optional()
});
export type CreateUserLecturerMappingDto = z.infer<typeof CreateUserLecturerMappingDtoSchema>;

export const UserLecturerMappingDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  lecturerId: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    role: UserRoleSchema
  }),
  lecturer: z.object({
    id: z.string(),
    name: z.string(),
    normalizedName: z.string()
  })
});
export type UserLecturerMappingDto = z.infer<typeof UserLecturerMappingDtoSchema>;

export const NotificationItemDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  payloadJson: z.unknown().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string()
});
export type NotificationItemDto = z.infer<typeof NotificationItemDtoSchema>;

export const MarkNotificationReadDtoSchema = z.object({
  id: z.string()
});
export type MarkNotificationReadDto = z.infer<typeof MarkNotificationReadDtoSchema>;

export const LecturerAnalyticsDtoSchema = z.object({
  lecturerId: z.string(),
  lecturerName: z.string(),
  sessionCount: z.number(),
  totalHours: z.number(),
  classTypeDistribution: z.record(z.string(), z.number()),
  peakWindow: z.string().nullable()
});
export type LecturerAnalyticsDto = z.infer<typeof LecturerAnalyticsDtoSchema>;

export const RoomAnalyticsDtoSchema = z.object({
  roomId: z.string(),
  roomName: z.string(),
  block: z.string().nullable(),
  level: z.string().nullable(),
  sessionCount: z.number(),
  occupiedHours: z.number(),
  occupancyRate: z.number(),
  idleHours: z.number()
});
export type RoomAnalyticsDto = z.infer<typeof RoomAnalyticsDtoSchema>;

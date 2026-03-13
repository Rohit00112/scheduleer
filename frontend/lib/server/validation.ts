import { z } from "zod";

import { UserRole } from "./entities";

const trimmedString = z.string().trim().min(1);

function optionalString() {
  return z.preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    const normalized = typeof value === "string" ? value.trim() : String(value).trim();
    return normalized === "" ? undefined : normalized;
  }, z.string().optional());
}

function optionalNumber() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    return Number(value);
  }, z.number().finite().optional());
}

export const userRoleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.USER,
  UserRole.INSTRUCTOR,
]);

export const loginSchema = z.object({
  username: trimmedString,
  password: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6),
});

const scheduleShape = {
  day: trimmedString,
  startTime: trimmedString,
  endTime: trimmedString,
  classType: trimmedString,
  year: z.coerce.number().finite(),
  moduleCode: trimmedString,
  moduleTitle: trimmedString,
  instructor: trimmedString,
  group: trimmedString,
  block: trimmedString,
  level: z.coerce.number().finite(),
  room: trimmedString,
  program: trimmedString,
  section: trimmedString,
  hours: optionalNumber(),
  specialization: optionalString(),
};

export const createScheduleSchema = z.object(scheduleShape);
export const updateScheduleSchema = createScheduleSchema.partial();
export const bulkSchedulesSchema = z.array(createScheduleSchema);

export const scheduleFilterSchema = z.object({
  day: optionalString(),
  program: optionalString(),
  year: optionalNumber(),
  section: optionalString(),
  instructor: optionalString(),
  room: optionalString(),
  classType: optionalString(),
  moduleCode: optionalString(),
});

export const checkConflictsSchema = z.object({
  schedule: updateScheduleSchema,
  excludeId: optionalNumber(),
});

export const auditQuerySchema = z.object({
  limit: optionalNumber(),
  offset: optionalNumber(),
});

export const announcementSchema = z.object({
  title: trimmedString,
  message: trimmedString,
  type: optionalString(),
});

export const createUserSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(6),
  role: userRoleSchema.optional(),
  instructorName: optionalString(),
});

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(6),
});

export const whatsappTestSchema = z.object({
  message: trimmedString,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type ScheduleFilterInput = z.infer<typeof scheduleFilterSchema>;
export type CheckConflictsInput = z.infer<typeof checkConflictsSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

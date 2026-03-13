import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getAuthenticatedUser, requireAuth, requireRole } from "./auth";
import { ApiError, getErrorMessage } from "./errors";
import { UserRole } from "./entities";
import {
  announcementSchema,
  auditQuerySchema,
  bulkSchedulesSchema,
  changePasswordSchema,
  checkConflictsSchema,
  createScheduleSchema,
  createUserSchema,
  loginSchema,
  resetUserPasswordSchema,
  scheduleFilterSchema,
  updateScheduleSchema,
  updateUserRoleSchema,
} from "./validation";
import {
  createAnnouncement,
  deleteAnnouncement,
  getActiveAnnouncements,
  getAllAnnouncements,
  toggleAnnouncement,
} from "./services/announcements";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  findUserById,
  listUsers,
  loginUser,
  resetUserPassword,
  updateUserRole,
} from "./services/auth-users";
import { exportCsv, generateExcel, importExcel } from "./services/import-export";
import { handleTelegramWebhook } from "./services/integrations";
import {
  getAllModules,
  getAllRooms,
  getAllTeacherAssignments,
  getDashboardStats,
  getInstructorDetails,
  getProgramSummary,
  getRoomById,
  getRoomUtilization,
  getTeacherAssignmentsByModule,
} from "./services/rooms-programs";
import {
  bulkCreateSchedules,
  checkConflictsForSchedule,
  createSchedule,
  deleteSchedule,
  detectAllConflicts,
  findAllSchedules,
  findScheduleById,
  getAuditLog,
  getDistinctInstructors,
  getDistinctModules,
  getDistinctPrograms,
  getDistinctRooms,
  getDistinctSections,
  getEntityAuditLog,
  logAudit,
  updateSchedule,
} from "./services/schedules";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function handleApiRequest(request: NextRequest): Promise<Response> {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean).slice(1);
  const method = request.method.toUpperCase();

  try {
    if (segments.length === 0) {
      return json({ message: "Not Found" }, 404);
    }

    switch (segments[0]) {
      case "auth":
        return await handleAuthRoute(request, method, segments.slice(1));
      case "schedules":
        return await handleSchedulesRoute(request, method, segments.slice(1));
      case "announcements":
        return await handleAnnouncementsRoute(request, method, segments.slice(1));
      case "users":
        return await handleUsersRoute(request, method, segments.slice(1));
      case "rooms":
        return await handleRoomsRoute(request, method, segments.slice(1));
      case "programs":
        return await handleProgramsRoute(request, method, segments.slice(1));
      case "instructors":
        return await handleInstructorsRoute(request, method, segments.slice(1));
      case "telegram":
        return await handleTelegramRoute(request, method, segments.slice(1));
      default:
        return json({ message: "Not Found" }, 404);
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function handleAuthRoute(request: NextRequest, method: string, segments: string[]) {
  if (segments.length === 1 && segments[0] === "login" && method === "POST") {
    return json(await loginUser(loginSchema.parse(await request.json())));
  }

  if (segments.length === 1 && segments[0] === "change-password" && method === "POST") {
    const auth = await requireAuth(request);
    return json(await changeUserPassword(auth, changePasswordSchema.parse(await request.json())));
  }

  if (segments.length === 1 && segments[0] === "me" && method === "GET") {
    const { auth } = await getAuthenticatedUser(request);
    const user = await findUserById(auth.sub);
    return json(
      user
        ? {
            id: user.id,
            username: user.username,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
            instructorName: user.instructorName,
          }
        : null,
    );
  }

  return json({ message: "Not Found" }, 404);
}

async function handleSchedulesRoute(
  request: NextRequest,
  method: string,
  segments: string[],
) {
  if (segments.length === 0 && method === "GET") {
    const filter = scheduleFilterSchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return json(await findAllSchedules(filter));
  }

  if (segments.length === 0 && method === "POST") {
    const auth = await requireAdmin(request);
    const body = createScheduleSchema.parse(await request.json());
    const schedule = await createSchedule(body);
    await logAudit(
      "create",
      "schedule",
      schedule.id,
      auth.username,
      `Created schedule: ${body.moduleCode} ${body.day} ${body.startTime}`,
      null,
      body,
    );
    return json(schedule);
  }

  if (segments.length === 1 && segments[0] === "bulk" && method === "POST") {
    await requireAdmin(request);
    return json(await bulkCreateSchedules(bulkSchedulesSchema.parse(await request.json())));
  }

  if (segments.length === 1 && segments[0] === "instructors" && method === "GET") {
    return json(await getDistinctInstructors());
  }

  if (segments.length === 1 && segments[0] === "rooms" && method === "GET") {
    return json(await getDistinctRooms());
  }

  if (segments.length === 1 && segments[0] === "programs" && method === "GET") {
    return json(await getDistinctPrograms());
  }

  if (segments.length === 1 && segments[0] === "sections" && method === "GET") {
    return json(await getDistinctSections());
  }

  if (segments.length === 1 && segments[0] === "modules" && method === "GET") {
    return json(await getDistinctModules());
  }

  if (segments.length === 1 && segments[0] === "conflicts" && method === "GET") {
    await requireAuth(request);
    return json(await detectAllConflicts());
  }

  if (segments.length === 1 && segments[0] === "check-conflicts" && method === "POST") {
    await requireAuth(request);
    const body = checkConflictsSchema.parse(await request.json());
    return json(await checkConflictsForSchedule(body.schedule, body.excludeId));
  }

  if (segments.length === 1 && segments[0] === "audit" && method === "GET") {
    await requireAdmin(request);
    const { limit, offset } = auditQuerySchema.parse(
      searchParamsToObject(request.nextUrl.searchParams),
    );
    return json(await getAuditLog(limit || 100, offset || 0));
  }

  if (segments.length === 3 && segments[0] === "audit" && method === "GET") {
    await requireAdmin(request);
    return json(await getEntityAuditLog(segments[1], parseId(segments[2], "entityId")));
  }

  if (segments.length === 1 && segments[0] === "export" && method === "GET") {
    await requireAdmin(request);
    const buffer = await generateExcel();
    return binary(buffer, {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Time Schedule for Spring 2026.xlsx"',
      "Content-Length": String(buffer.length),
    });
  }

  if (segments.length === 2 && segments[0] === "export" && segments[1] === "csv" && method === "GET") {
    await requireAdmin(request);
    const csv = await exportCsv();
    return text(csv, {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="schedules.csv"',
    });
  }

  if (segments.length === 1 && segments[0] === "import" && method === "POST") {
    const auth = await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      throw new ApiError(400, "Missing file");
    }

    const result = await importExcel(Buffer.from(await file.arrayBuffer()));
    await logAudit(
      "import",
      "schedule",
      null,
      auth.username,
      `Imported ${result.imported} schedules from Excel`,
    );
    return json(result);
  }

  if (segments.length === 1 && method === "GET") {
    return json(await findScheduleById(parseId(segments[0], "id")));
  }

  if (segments.length === 1 && method === "PUT") {
    const auth = await requireAdmin(request);
    const id = parseId(segments[0], "id");
    const body = updateScheduleSchema.parse(await request.json());
    const oldSchedule = await findScheduleById(id);
    const updated = await updateSchedule(id, body);
    await logAudit(
      "update",
      "schedule",
      id,
      auth.username,
      `Updated schedule #${id}`,
      oldSchedule,
      body,
    );
    return json(updated);
  }

  if (segments.length === 1 && method === "DELETE") {
    const auth = await requireAdmin(request);
    const id = parseId(segments[0], "id");
    const oldSchedule = await findScheduleById(id);
    const result = await deleteSchedule(id);
    await logAudit(
      "delete",
      "schedule",
      id,
      auth.username,
      `Deleted schedule: ${oldSchedule.moduleCode} ${oldSchedule.day} ${oldSchedule.startTime}`,
      oldSchedule,
    );
    return json(result);
  }

  return json({ message: "Not Found" }, 404);
}

async function handleAnnouncementsRoute(
  request: NextRequest,
  method: string,
  segments: string[],
) {
  if (segments.length === 0 && method === "GET") {
    return json(await getActiveAnnouncements());
  }

  if (segments.length === 1 && segments[0] === "all" && method === "GET") {
    await requireAdmin(request);
    return json(await getAllAnnouncements());
  }

  if (segments.length === 0 && method === "POST") {
    const auth = await requireAdmin(request);
    const body = announcementSchema.parse(await request.json());
    return json(await createAnnouncement(body, auth.username));
  }

  if (segments.length === 1 && method === "DELETE") {
    await requireAdmin(request);
    return json(await deleteAnnouncement(parseId(segments[0], "id")));
  }

  if (segments.length === 2 && segments[1] === "toggle" && method === "PATCH") {
    await requireAdmin(request);
    return json(await toggleAnnouncement(parseId(segments[0], "id")));
  }

  return json({ message: "Not Found" }, 404);
}

async function handleUsersRoute(request: NextRequest, method: string, segments: string[]) {
  await requireAdmin(request);

  if (segments.length === 0 && method === "GET") {
    return json(await listUsers());
  }

  if (segments.length === 0 && method === "POST") {
    return json(await createUser(createUserSchema.parse(await request.json())));
  }

  if (segments.length === 2 && segments[1] === "role" && method === "PUT") {
    const body = updateUserRoleSchema.parse(await request.json());
    return json(await updateUserRole(parseId(segments[0], "id"), body.role));
  }

  if (segments.length === 2 && segments[1] === "password" && method === "PUT") {
    const body = resetUserPasswordSchema.parse(await request.json());
    return json(await resetUserPassword(parseId(segments[0], "id"), body.password));
  }

  if (segments.length === 1 && method === "DELETE") {
    return json(await deleteUser(parseId(segments[0], "id")));
  }

  return json({ message: "Not Found" }, 404);
}

async function handleRoomsRoute(request: NextRequest, method: string, segments: string[]) {
  if (segments.length === 0 && method === "GET") {
    return json(await getAllRooms());
  }

  if (segments.length === 1 && segments[0] === "utilization" && method === "GET") {
    await requireAuth(request);
    return json(await getRoomUtilization());
  }

  if (segments.length === 1 && method === "GET") {
    return json(await getRoomById(parseId(segments[0], "id")));
  }

  return json({ message: "Not Found" }, 404);
}

async function handleProgramsRoute(
  request: NextRequest,
  method: string,
  segments: string[],
) {
  if (segments.length === 1 && segments[0] === "summary" && method === "GET") {
    return json(await getProgramSummary());
  }

  if (segments.length === 1 && segments[0] === "modules" && method === "GET") {
    return json(await getAllModules());
  }

  if (segments.length === 1 && segments[0] === "assignments" && method === "GET") {
    await requireAuth(request);
    return json(await getAllTeacherAssignments());
  }

  if (segments.length === 2 && segments[0] === "assignments" && method === "GET") {
    await requireAuth(request);
    return json(await getTeacherAssignmentsByModule(decodeURIComponent(segments[1])));
  }

  return json({ message: "Not Found" }, 404);
}

async function handleInstructorsRoute(
  request: NextRequest,
  method: string,
  segments: string[],
) {
  if (segments.length === 1 && segments[0] === "dashboard" && method === "GET") {
    return json(await getDashboardStats());
  }

  if (segments.length === 1 && segments[0] === "details" && method === "GET") {
    await requireAuth(request);
    return json(await getInstructorDetails());
  }

  return json({ message: "Not Found" }, 404);
}

async function handleTelegramRoute(
  request: NextRequest,
  method: string,
  segments: string[],
) {
  if (segments.length === 1 && segments[0] === "webhook" && method === "POST") {
    const body = await request.json();
    return json(
      await handleTelegramWebhook(
        body,
        request.headers.get("x-telegram-bot-api-secret-token"),
      ),
    );
  }

  return json({ message: "Not Found" }, 404);
}

async function requireAdmin(request: NextRequest) {
  const auth = await requireAuth(request);
  requireRole(auth, UserRole.ADMIN);
  return auth;
}

function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}

function parseId(value: string, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ApiError(400, `Invalid ${fieldName}`);
  }
  return parsed;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function text(body: string, headers: Record<string, string>, status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...headers,
      ...NO_STORE_HEADERS,
    },
  });
}

function binary(body: Buffer, headers: Record<string, string>, status = 200) {
  return new Response(new Uint8Array(body), {
    status,
    headers: {
      ...headers,
      ...NO_STORE_HEADERS,
    },
  });
}

function toErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return json(
      {
        message: "Invalid request",
        issues: error.issues,
      },
      400,
    );
  }

  if (error instanceof ApiError) {
    return json(
      {
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      error.status,
    );
  }

  console.error(error);
  return json({ message: getErrorMessage(error) }, 500);
}

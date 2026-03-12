import { ApiError } from "../errors";
import { Schedule } from "../entities";
import type {
  CreateScheduleInput,
  ScheduleFilterInput,
  UpdateScheduleInput,
} from "../validation";
import { getRepositories } from "./repositories";

export interface Conflict {
  type: "instructor" | "room" | "group";
  day: string;
  startTime: string;
  endTime: string;
  resource: string;
  schedules: Schedule[];
}

export async function logAudit(
  action: string,
  entityType: string,
  entityId: number | null,
  username: string,
  description?: string,
  oldValues?: unknown,
  newValues?: unknown,
) {
  const { auditRepo } = await getRepositories();
  const entry = auditRepo.create({
    action,
    entityType,
    entityId,
    username,
    description: description || null,
    oldValues: oldValues ? JSON.stringify(oldValues) : null,
    newValues: newValues ? JSON.stringify(newValues) : null,
  });

  return auditRepo.save(entry);
}

export async function findAllSchedules(filter: ScheduleFilterInput = {}) {
  const { scheduleRepo } = await getRepositories();
  const queryBuilder = scheduleRepo.createQueryBuilder("s");

  if (filter.day) {
    queryBuilder.andWhere("s.day = :day", { day: filter.day });
  }
  if (filter.program) {
    queryBuilder.andWhere("s.program = :program", { program: filter.program });
  }
  if (filter.year) {
    queryBuilder.andWhere("s.year = :year", { year: filter.year });
  }
  if (filter.section) {
    queryBuilder.andWhere("s.section = :section", { section: filter.section });
  }
  if (filter.instructor) {
    queryBuilder.andWhere("s.instructor LIKE :instructor", {
      instructor: `%${filter.instructor}%`,
    });
  }
  if (filter.room) {
    queryBuilder.andWhere("s.room LIKE :room", {
      room: `%${filter.room}%`,
    });
  }
  if (filter.classType) {
    queryBuilder.andWhere("s.classType = :classType", {
      classType: filter.classType,
    });
  }
  if (filter.moduleCode) {
    queryBuilder.andWhere("s.moduleCode = :moduleCode", {
      moduleCode: filter.moduleCode,
    });
  }

  queryBuilder
    .orderBy(
      `CASE s.day
        WHEN 'Sunday' THEN 0
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        WHEN 'Saturday' THEN 6
      END`,
    )
    .addOrderBy("s.startTime");

  return queryBuilder.getMany();
}

export async function findScheduleById(id: number) {
  const { scheduleRepo } = await getRepositories();
  const schedule = await scheduleRepo.findOne({ where: { id } });
  if (!schedule) {
    throw new ApiError(404, `Schedule #${id} not found`);
  }

  return schedule;
}

export async function createSchedule(input: CreateScheduleInput) {
  const { scheduleRepo } = await getRepositories();
  const schedule = scheduleRepo.create(input);
  return scheduleRepo.save(schedule);
}

export async function bulkCreateSchedules(inputs: CreateScheduleInput[]) {
  const { scheduleRepo } = await getRepositories();
  const entities = inputs.map((input) => scheduleRepo.create(input));
  await scheduleRepo.save(entities);
  return entities.length;
}

export async function updateSchedule(id: number, input: UpdateScheduleInput) {
  const { scheduleRepo } = await getRepositories();
  const schedule = await findScheduleById(id);
  Object.assign(schedule, input);
  return scheduleRepo.save(schedule);
}

export async function deleteSchedule(id: number) {
  const { scheduleRepo } = await getRepositories();
  const schedule = await findScheduleById(id);
  await scheduleRepo.remove(schedule);
  return { success: true };
}

export async function getDistinctInstructors() {
  const { scheduleRepo } = await getRepositories();
  const result = await scheduleRepo
    .createQueryBuilder("s")
    .select("DISTINCT s.instructor", "instructor")
    .orderBy("s.instructor")
    .getRawMany<{ instructor: string }>();

  return result.map((row) => row.instructor);
}

export async function getDistinctRooms() {
  const { scheduleRepo } = await getRepositories();
  const result = await scheduleRepo
    .createQueryBuilder("s")
    .select("DISTINCT s.room", "room")
    .orderBy("s.room")
    .getRawMany<{ room: string }>();

  return result.map((row) => row.room);
}

export async function getDistinctPrograms() {
  const { scheduleRepo } = await getRepositories();
  const result = await scheduleRepo
    .createQueryBuilder("s")
    .select("DISTINCT s.program", "program")
    .orderBy("s.program")
    .getRawMany<{ program: string }>();

  return result.map((row) => row.program);
}

export async function getDistinctSections() {
  const { scheduleRepo } = await getRepositories();
  const result = await scheduleRepo
    .createQueryBuilder("s")
    .select("DISTINCT s.section", "section")
    .orderBy("s.section")
    .getRawMany<{ section: string }>();

  return result.map((row) => row.section);
}

export async function getDistinctModules() {
  const { scheduleRepo } = await getRepositories();
  return scheduleRepo
    .createQueryBuilder("s")
    .select("s.moduleCode", "code")
    .addSelect("MIN(s.moduleTitle)", "title")
    .groupBy("s.moduleCode")
    .orderBy("s.moduleCode")
    .getRawMany<{ code: string; title: string }>();
}

export async function getAuditLog(limit = 100, offset = 0) {
  const { auditRepo } = await getRepositories();
  return auditRepo.find({
    order: { createdAt: "DESC" },
    take: limit,
    skip: offset,
  });
}

export async function getEntityAuditLog(entityType: string, entityId: number) {
  const { auditRepo } = await getRepositories();
  return auditRepo.find({
    where: { entityType, entityId },
    order: { createdAt: "DESC" },
  });
}

export async function detectAllConflicts(): Promise<Conflict[]> {
  const { scheduleRepo } = await getRepositories();
  const all = deduplicateSchedules(await scheduleRepo.find());
  const conflicts: Conflict[] = [];
  const byDay = groupBy(all, (schedule) => schedule.day);

  for (const daySchedules of Object.values(byDay)) {
    conflicts.push(
      ...findOverlaps(daySchedules, "instructor", (schedule) =>
        (schedule.instructor || "").toLowerCase(),
      ),
    );
    conflicts.push(...findOverlaps(daySchedules, "room", (schedule) => schedule.room));
    conflicts.push(
      ...findOverlaps(
        daySchedules,
        "group",
        (schedule) => `${schedule.program}-${schedule.section}-${schedule.group}`,
      ),
    );
  }

  return conflicts;
}

export async function checkConflictsForSchedule(
  schedule: Partial<CreateScheduleInput>,
  excludeId?: number,
): Promise<Conflict[]> {
  if (!schedule.day || !schedule.startTime || !schedule.endTime) {
    return [];
  }

  const { scheduleRepo } = await getRepositories();
  const queryBuilder = scheduleRepo
    .createQueryBuilder("s")
    .where("s.day = :day", { day: schedule.day });

  if (excludeId) {
    queryBuilder.andWhere("s.id != :id", { id: excludeId });
  }

  const sameDaySchedules = await queryBuilder.getMany();
  const conflicts: Conflict[] = [];

  for (const existing of sameDaySchedules) {
    if (!timesOverlap(schedule.startTime, schedule.endTime, existing.startTime, existing.endTime)) {
      continue;
    }

    if (schedule.instructor && schedule.instructor === existing.instructor) {
      conflicts.push({
        type: "instructor",
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        resource: schedule.instructor,
        schedules: [existing],
      });
    }

    if (schedule.room && schedule.room === existing.room) {
      conflicts.push({
        type: "room",
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        resource: schedule.room,
        schedules: [existing],
      });
    }

    const scheduleGroup = `${schedule.program}-${schedule.section}-${schedule.group}`;
    const existingGroup = `${existing.program}-${existing.section}-${existing.group}`;

    if (schedule.group && scheduleGroup === existingGroup) {
      conflicts.push({
        type: "group",
        day: schedule.day,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        resource: scheduleGroup,
        schedules: [existing],
      });
    }
  }

  return conflicts;
}

function findOverlaps(
  schedules: Schedule[],
  type: Conflict["type"],
  keyFn: (schedule: Schedule) => string,
): Conflict[] {
  const conflicts: Conflict[] = [];
  const byResource = groupBy(schedules, keyFn);

  for (const [resource, resourceSchedules] of Object.entries(byResource)) {
    if (!resource || resourceSchedules.length < 2) {
      continue;
    }

    for (let i = 0; i < resourceSchedules.length; i += 1) {
      for (let j = i + 1; j < resourceSchedules.length; j += 1) {
        const first = resourceSchedules[i];
        const second = resourceSchedules[j];

        if (
          !timesOverlap(first.startTime, first.endTime, second.startTime, second.endTime)
        ) {
          continue;
        }

        const existing = conflicts.find(
          (conflict) =>
            conflict.type === type &&
            conflict.resource === resource &&
            conflict.day === first.day &&
            conflict.schedules.some((schedule) => schedule.id === first.id),
        );

        if (existing) {
          if (!existing.schedules.some((schedule) => schedule.id === second.id)) {
            existing.schedules.push(second);
          }
        } else {
          conflicts.push({
            type,
            day: first.day,
            startTime: first.startTime,
            endTime: first.endTime,
            resource,
            schedules: [first, second],
          });
        }
      }
    }
  }

  return conflicts;
}

function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const toMinutes = (time: string) => {
    const normalized = time.trim().toUpperCase();

    if (normalized.includes("AM") || normalized.includes("PM")) {
      const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
      if (!match) {
        return 0;
      }

      let hours = Number.parseInt(match[1], 10);
      const minutes = Number.parseInt(match[2], 10);
      if (match[3] === "PM" && hours !== 12) {
        hours += 12;
      }
      if (match[3] === "AM" && hours === 12) {
        hours = 0;
      }
      return hours * 60 + minutes;
    }

    const [hours, minutes] = normalized.split(":").map(Number);
    return hours * 60 + (minutes || 0);
  };

  const firstStart = toMinutes(start1);
  const firstEnd = toMinutes(end1);
  const secondStart = toMinutes(start2);
  const secondEnd = toMinutes(end2);

  return firstStart < secondEnd && secondStart < firstEnd;
}

function deduplicateSchedules(schedules: Schedule[]) {
  const seen = new Set<string>();

  return schedules.filter((schedule) => {
    const key = [
      schedule.day,
      schedule.startTime,
      schedule.endTime,
      schedule.classType,
      schedule.moduleCode,
      (schedule.instructor || "").toLowerCase(),
      schedule.group,
      schedule.room,
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {};

  for (const item of items) {
    const key = keyFn(item);
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(item);
  }

  return map;
}

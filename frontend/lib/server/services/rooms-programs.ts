import { ApiError } from "../errors";
import { getRepositories } from "./repositories";

export async function getAllRooms() {
  const { roomRepo } = await getRepositories();
  return roomRepo.find({ order: { block: "ASC", level: "ASC", name: "ASC" } });
}

export async function getRoomById(id: number) {
  const { roomRepo } = await getRepositories();
  const room = await roomRepo.findOne({ where: { id } });
  if (!room) {
    throw new ApiError(404, `Room #${id} not found`);
  }
  return room;
}

export async function getRoomUtilization() {
  const { roomRepo, scheduleRepo } = await getRepositories();
  const allRooms = await roomRepo.find({ order: { name: "ASC" } });
  const schedules = await scheduleRepo.find();

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15];
  const totalSlots = days.length * hours.length;

  const roomOccupancy = new Map<string, Set<string>>();
  const roomClassCounts = new Map<
    string,
    { lectures: number; tutorials: number; workshops: number }
  >();

  for (const schedule of schedules) {
    if (!schedule.room) {
      continue;
    }

    const slots = roomOccupancy.get(schedule.room) || new Set<string>();
    const startHour = timeToHour(schedule.startTime);
    const endHour = timeToHour(schedule.endTime);

    for (let hour = startHour; hour < endHour; hour += 1) {
      slots.add(`${schedule.day}-${hour}`);
    }

    roomOccupancy.set(schedule.room, slots);

    const counts = roomClassCounts.get(schedule.room) || {
      lectures: 0,
      tutorials: 0,
      workshops: 0,
    };

    if (schedule.classType === "Lecture") {
      counts.lectures += 1;
    } else if (schedule.classType === "Tutorial") {
      counts.tutorials += 1;
    } else if (schedule.classType === "Workshop") {
      counts.workshops += 1;
    }

    roomClassCounts.set(schedule.room, counts);
  }

  const heatmap: Record<string, number> = {};
  for (const day of days) {
    for (const hour of hours) {
      const key = `${day}-${hour}`;
      let count = 0;
      roomOccupancy.forEach((slots) => {
        if (slots.has(key)) {
          count += 1;
        }
      });
      heatmap[key] = count;
    }
  }

  const roomStats = allRooms.map((room) => {
    const occupiedSlots = roomOccupancy.get(room.name)?.size || 0;
    const utilizationPct = totalSlots > 0 ? (occupiedSlots / totalSlots) * 100 : 0;

    return {
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      block: room.block,
      level: room.level,
      furnitureType: room.furnitureType,
      occupiedSlots,
      totalSlots,
      utilizationPct,
      classCounts: roomClassCounts.get(room.name) || {
        lectures: 0,
        tutorials: 0,
        workshops: 0,
      },
    };
  });

  const knownRoomNames = new Set(allRooms.map((room) => room.name));
  for (const [roomName, slots] of roomOccupancy.entries()) {
    if (knownRoomNames.has(roomName)) {
      continue;
    }

    roomStats.push({
      id: 0,
      name: roomName,
      capacity: null,
      block: "",
      level: "",
      furnitureType: null,
      occupiedSlots: slots.size,
      totalSlots,
      utilizationPct: totalSlots > 0 ? (slots.size / totalSlots) * 100 : 0,
      classCounts: roomClassCounts.get(roomName) || {
        lectures: 0,
        tutorials: 0,
        workshops: 0,
      },
    });
  }

  roomStats.sort((left, right) => right.utilizationPct - left.utilizationPct);

  const avgUtilization = roomStats.length
    ? roomStats.reduce((sum, room) => sum + room.utilizationPct, 0) / roomStats.length
    : 0;

  return {
    rooms: roomStats,
    heatmap,
    summary: {
      totalRooms: roomStats.length,
      avgUtilization,
      underUsed: roomStats.filter((room) => room.utilizationPct < 20).length,
      overUsed: roomStats.filter((room) => room.utilizationPct > 60).length,
      totalCapacity: allRooms.reduce((sum, room) => sum + (room.capacity || 0), 0),
    },
  };
}

export async function getDashboardStats() {
  const { scheduleRepo } = await getRepositories();
  const schedules = await scheduleRepo.find();

  const instructors = new Set(schedules.map((schedule) => schedule.instructor));
  const rooms = new Set(schedules.map((schedule) => schedule.room));
  const modules = new Set(schedules.map((schedule) => schedule.moduleCode));
  const programs = new Set(schedules.map((schedule) => schedule.program));

  const classTypeMap = new Map<string, number>();
  schedules.forEach((schedule) => {
    classTypeMap.set(
      schedule.classType,
      (classTypeMap.get(schedule.classType) || 0) + 1,
    );
  });

  const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const dayMap = new Map<string, number>();
  schedules.forEach((schedule) => {
    dayMap.set(schedule.day, (dayMap.get(schedule.day) || 0) + 1);
  });

  const byDay = dayOrder.map((day) => ({ day, count: dayMap.get(day) || 0 }));

  const programYearMap = new Map<
    string,
    { total: number; year1: number; year2: number; year3: number }
  >();

  schedules.forEach((schedule) => {
    const entry = programYearMap.get(schedule.program) || {
      total: 0,
      year1: 0,
      year2: 0,
      year3: 0,
    };

    entry.total += 1;
    if (schedule.year === 1) {
      entry.year1 += 1;
    } else if (schedule.year === 2) {
      entry.year2 += 1;
    } else if (schedule.year === 3) {
      entry.year3 += 1;
    }

    programYearMap.set(schedule.program, entry);
  });

  const byProgram = Array.from(programYearMap.entries()).map(([program, entry]) => ({
    program,
    count: entry.total,
    year1: entry.year1,
    year2: entry.year2,
    year3: entry.year3,
  }));

  const instructorMap = new Map<string, { classes: number; hours: number }>();
  schedules.forEach((schedule) => {
    const entry = instructorMap.get(schedule.instructor) || { classes: 0, hours: 0 };
    entry.classes += 1;
    entry.hours += schedule.hours || 1.5;
    instructorMap.set(schedule.instructor, entry);
  });

  const busyInstructors = Array.from(instructorMap.entries())
    .map(([instructor, entry]) => ({ instructor, ...entry }))
    .sort((left, right) => right.hours - left.hours)
    .slice(0, 10);

  const roomMap = new Map<string, number>();
  schedules.forEach((schedule) => {
    roomMap.set(schedule.room, (roomMap.get(schedule.room) || 0) + 1);
  });

  const busyRooms = Array.from(roomMap.entries())
    .map(([room, classes]) => ({ room, classes }))
    .sort((left, right) => right.classes - left.classes)
    .slice(0, 10);

  const timeSlots = [
    "08:00 AM",
    "09:30 AM",
    "10:30 AM",
    "12:00 PM",
    "12:30 PM",
    "02:00 PM",
    "02:30 PM",
    "04:00 PM",
  ];
  const timeMap = new Map<string, number>();
  schedules.forEach((schedule) => {
    timeMap.set(schedule.startTime.trim(), (timeMap.get(schedule.startTime.trim()) || 0) + 1);
  });

  const timeDistribution = timeSlots
    .filter((slot) => timeMap.has(slot))
    .map((slot) => ({ slot, count: timeMap.get(slot) || 0 }));

  return {
    overview: {
      totalClasses: schedules.length,
      totalInstructors: instructors.size,
      totalRooms: rooms.size,
      totalModules: modules.size,
      totalPrograms: programs.size,
      classTypes: Array.from(classTypeMap.entries()).map(([type, count]) => ({
        type,
        count,
      })),
    },
    byDay,
    byProgram,
    busyInstructors,
    busyRooms,
    timeDistribution,
  };
}

export async function getInstructorDetails() {
  const { scheduleRepo } = await getRepositories();
  const schedules = await scheduleRepo.find();

  const byInstructor = new Map<string, typeof schedules>();
  schedules.forEach((schedule) => {
    const list = byInstructor.get(schedule.instructor) || [];
    list.push(schedule);
    byInstructor.set(schedule.instructor, list);
  });

  return Array.from(byInstructor.entries())
    .map(([instructor, classes]) => {
      const typeMap = new Map<string, number>();
      classes.forEach((schedule) => {
        typeMap.set(schedule.classType, (typeMap.get(schedule.classType) || 0) + 1);
      });

      return {
        instructor,
        totalClasses: classes.length,
        totalHours: classes.reduce((sum, schedule) => sum + (schedule.hours || 1.5), 0),
        modules: [...new Set(classes.map((schedule) => schedule.moduleCode))].sort(),
        days: [...new Set(classes.map((schedule) => schedule.day))].sort(),
        classTypes: Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })),
        programs: [...new Set(classes.map((schedule) => schedule.program))].sort(),
      };
    })
    .sort((left, right) => left.instructor.localeCompare(right.instructor));
}

export async function getProgramSummary() {
  const { assignmentRepo, moduleRepo, scheduleRepo } = await getRepositories();
  const schedules = await scheduleRepo.find();
  const moduleCatalog = await moduleRepo.find({ order: { code: "ASC" } });
  const teacherAssignments = await assignmentRepo.find({ order: { moduleCode: "ASC" } });

  const programMap = new Map<string, typeof schedules>();
  for (const schedule of schedules) {
    const list = programMap.get(schedule.program) || [];
    list.push(schedule);
    programMap.set(schedule.program, list);
  }

  const programs = Array.from(programMap.entries())
    .map(([name, programSchedules]) => {
      const yearMap = new Map<number, typeof schedules>();
      for (const schedule of programSchedules) {
        const list = yearMap.get(schedule.year) || [];
        list.push(schedule);
        yearMap.set(schedule.year, list);
      }

      const years = Array.from(yearMap.entries())
        .sort(([left], [right]) => left - right)
        .map(([year, yearSchedules]) => ({
          year,
          sections: [...new Set(yearSchedules.map((schedule) => schedule.section))].sort(),
          totalClasses: yearSchedules.length,
          modules: [...new Set(yearSchedules.map((schedule) => schedule.moduleCode))].sort(),
          instructors: [...new Set(yearSchedules.map((schedule) => schedule.instructor))].sort(),
        }));

      return {
        name,
        years,
        totalClasses: programSchedules.length,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    programs,
    moduleCatalog,
    teacherAssignments,
  };
}

export async function getAllModules() {
  const { moduleRepo } = await getRepositories();
  return moduleRepo.find({ order: { code: "ASC" } });
}

export async function getAllTeacherAssignments() {
  const { assignmentRepo } = await getRepositories();
  return assignmentRepo.find({ order: { moduleCode: "ASC", classType: "ASC" } });
}

export async function getTeacherAssignmentsByModule(moduleCode: string) {
  const { assignmentRepo } = await getRepositories();
  return assignmentRepo.find({
    where: { moduleCode },
    order: { classType: "ASC" },
  });
}

function timeToHour(time: string): number {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) {
    return 0;
  }

  let hours = Number.parseInt(match[1], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) {
    hours += 12;
  }
  if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours;
}

export interface Schedule {
    id: number;
    day: string;
    startTime: string;
    endTime: string;
    classType: string;
    year: number;
    moduleCode: string;
    moduleTitle: string;
    instructor: string;
    group: string;
    block: string;
    level: number;
    room: string;
    program: string;
    section: string;
    hours: number | null;
    specialization: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ScheduleFilter {
    day?: string;
    program?: string;
    year?: number;
    section?: string;
    instructor?: string;
    room?: string;
    classType?: string;
    moduleCode?: string;
}

export interface ModuleInfo {
    code: string;
    title: string;
}

export interface AuthUser {
    id: number;
    username: string;
    role: 'admin' | 'user' | 'instructor';
    mustChangePassword: boolean;
    instructorName: string | null;
}

export interface AuthResponse {
    accessToken: string;
    user: AuthUser;
}

export interface Conflict {
    type: 'instructor' | 'room' | 'group';
    day: string;
    startTime: string;
    endTime: string;
    resource: string;
    schedules: Schedule[];
}

export interface AuditLog {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    username: string;
    oldValues: string | null;
    newValues: string | null;
    description: string | null;
    createdAt: string;
}

export interface Announcement {
    id: number;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'urgent';
    createdBy: string;
    active: boolean;
    createdAt: string;
}

export interface Room {
    id: number;
    name: string;
    capacity: number | null;
    block: string | null;
    level: string | null;
    furnitureType: string | null;
}

export interface RoomUtilizationData {
    id: number;
    name: string;
    capacity: number | null;
    block: string;
    level: string;
    furnitureType: string | null;
    occupiedSlots: number;
    totalSlots: number;
    utilizationPct: number;
    classCounts: { lectures: number; tutorials: number; workshops: number };
}

export interface ModuleCatalogItem {
    id: number;
    code: string;
    title: string;
}

export interface TeacherAssignmentItem {
    id: number;
    moduleCode: string;
    classType: string | null;
    teacher: string;
    block: string | null;
}

export interface DashboardStats {
    overview: {
        totalClasses: number;
        totalInstructors: number;
        totalRooms: number;
        totalModules: number;
        totalPrograms: number;
        classTypes: { type: string; count: number }[];
    };
    byDay: { day: string; count: number }[];
    byProgram: { program: string; count: number; year1: number; year2: number; year3: number }[];
    busyInstructors: { instructor: string; classes: number; hours: number }[];
    busyRooms: { room: string; classes: number }[];
    timeDistribution: { slot: string; count: number }[];
}

export interface ProgramSummary {
    name: string;
    years: {
        year: number;
        sections: string[];
        totalClasses: number;
        modules: string[];
        instructors: string[];
    }[];
    totalClasses: number;
}

export interface ImportResult {
    imported: number;
    rooms: number;
    modules: number;
    assignments: number;
    errors: string[];
}

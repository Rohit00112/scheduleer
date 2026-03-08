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
    role: 'admin' | 'user';
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

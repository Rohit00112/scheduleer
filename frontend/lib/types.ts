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

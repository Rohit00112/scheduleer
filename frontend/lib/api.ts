import { Schedule, ScheduleFilter, AuthResponse, AuthUser, Conflict, AuditLog, Announcement, RoomUtilizationData, DashboardStats, ModuleCatalogItem, TeacherAssignmentItem, ProgramSummary, ImportResult } from "./types";

function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((init?.headers as Record<string, string>) || {}),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(path, {
        ...init,
        headers,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `API error: ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return undefined as T;
    }

    return res.json();
}

// Auth
export async function login(username: string, password: string): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
}

export async function getMe(): Promise<AuthUser | null> {
    try {
        return await fetchApi("/api/auth/me");
    } catch {
        return null;
    }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
    });
}

export async function getSchedules(filter: ScheduleFilter = {}): Promise<Schedule[]> {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
            params.append(key, String(value));
        }
    });
    const query = params.toString();
    return fetchApi<Schedule[]>(`/api/schedules${query ? `?${query}` : ""}`);
}

export async function getSchedule(id: number): Promise<Schedule> {
    return fetchApi<Schedule>(`/api/schedules/${id}`);
}

export async function createSchedule(data: Omit<Schedule, "id" | "createdAt" | "updatedAt">): Promise<Schedule> {
    return fetchApi<Schedule>("/api/schedules", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function updateSchedule(id: number, data: Partial<Schedule>): Promise<Schedule> {
    return fetchApi<Schedule>(`/api/schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

export async function deleteSchedule(id: number): Promise<void> {
    await fetchApi(`/api/schedules/${id}`, { method: "DELETE" });
}

export async function getInstructors(): Promise<string[]> {
    return fetchApi<string[]>("/api/schedules/instructors");
}

export async function getRooms(): Promise<string[]> {
    return fetchApi<string[]>("/api/schedules/rooms");
}

export async function getPrograms(): Promise<string[]> {
    return fetchApi<string[]>("/api/schedules/programs");
}

export async function getSections(): Promise<string[]> {
    return fetchApi<string[]>("/api/schedules/sections");
}

export async function getModules(): Promise<{ code: string; title: string }[]> {
    return fetchApi<{ code: string; title: string }[]>("/api/schedules/modules");
}

export async function exportExcel(): Promise<void> {
    const token = getToken();
    const res = await fetch("/api/schedules/export", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Time Schedule for Spring 2026.xlsx";
    a.click();
    URL.revokeObjectURL(url);
}

// CSV Export
export async function exportCsv(): Promise<void> {
    const token = getToken();
    const res = await fetch("/api/schedules/export/csv", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("CSV export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schedules.csv";
    a.click();
    URL.revokeObjectURL(url);
}

// Excel Import
export async function importExcel(file: File): Promise<ImportResult> {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/schedules/import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
    });
    if (!res.ok) throw new Error("Import failed");
    return res.json();
}

// Conflicts
export async function getConflicts(): Promise<Conflict[]> {
    return fetchApi<Conflict[]>("/api/schedules/conflicts");
}

export async function checkConflicts(
    schedule: Partial<Schedule>,
    excludeId?: number
): Promise<Conflict[]> {
    return fetchApi<Conflict[]>("/api/schedules/check-conflicts", {
        method: "POST",
        body: JSON.stringify({ schedule, excludeId }),
    });
}

// Audit Log
export async function getAuditLog(limit = 100, offset = 0): Promise<AuditLog[]> {
    return fetchApi<AuditLog[]>(`/api/schedules/audit?limit=${limit}&offset=${offset}`);
}

// Announcements
export async function getAnnouncements(): Promise<Announcement[]> {
    return fetchApi<Announcement[]>("/api/announcements");
}

export async function getAllAnnouncements(): Promise<Announcement[]> {
    return fetchApi<Announcement[]>("/api/announcements/all");
}

export async function createAnnouncement(data: { title: string; message: string; type?: string }): Promise<Announcement> {
    return fetchApi<Announcement>("/api/announcements", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function deleteAnnouncement(id: number): Promise<void> {
    await fetchApi(`/api/announcements/${id}`, { method: "DELETE" });
}

export async function toggleAnnouncement(id: number): Promise<Announcement> {
    return fetchApi<Announcement>(`/api/announcements/${id}/toggle`, { method: "PATCH" });
}

// User Management
export async function getUsers(): Promise<{ id: number; username: string; role: string }[]> {
    return fetchApi("/api/users");
}

// Room Utilization (server-side with capacity)
export async function getRoomUtilization(): Promise<{ rooms: RoomUtilizationData[]; heatmap: Record<string, number>; summary: { totalRooms: number; avgUtilization: number; underUsed: number; overUsed: number; totalCapacity: number } }> {
    return fetchApi("/api/rooms/utilization");
}

// Dashboard Stats
export async function getDashboardStats(): Promise<DashboardStats> {
    return fetchApi<DashboardStats>("/api/instructors/dashboard");
}

// Program Summary
export async function getProgramSummary(): Promise<{ programs: ProgramSummary[]; moduleCatalog: ModuleCatalogItem[]; teacherAssignments: TeacherAssignmentItem[] }> {
    return fetchApi("/api/programs/summary");
}

// Module Catalog
export async function getModuleCatalog(): Promise<ModuleCatalogItem[]> {
    return fetchApi<ModuleCatalogItem[]>("/api/programs/modules");
}

// Teacher Assignments
export async function getTeacherAssignments(moduleCode?: string): Promise<TeacherAssignmentItem[]> {
    const path = moduleCode ? `/api/programs/assignments/${encodeURIComponent(moduleCode)}` : "/api/programs/assignments";
    return fetchApi<TeacherAssignmentItem[]>(path);
}

type UserRecord = { id: number; username: string; role: string; mustChangePassword: boolean; instructorName: string | null };

export async function createUser(username: string, password: string, role?: string): Promise<UserRecord> {
    return fetchApi<UserRecord>("/api/users", {
        method: "POST",
        body: JSON.stringify({ username, password, role }),
    });
}

export async function updateUserRole(id: number, role: string): Promise<UserRecord> {
    return fetchApi<UserRecord>(`/api/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
    });
}

export async function resetUserPassword(id: number, password: string): Promise<{ success: boolean }> {
    return fetchApi<{ success: boolean }>(`/api/users/${id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password }),
    });
}

export async function deleteUser(id: number): Promise<void> {
    await fetchApi(`/api/users/${id}`, { method: "DELETE" });
}

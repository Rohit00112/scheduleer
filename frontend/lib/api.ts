import { Schedule, ScheduleFilter, AuthResponse, Conflict, AuditLog, Announcement } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `API error: ${res.status} ${res.statusText}`);
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

export async function register(username: string, password: string): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
}

export async function getMe(): Promise<{ id: number; username: string; role: string } | null> {
    try {
        return await fetchApi("/api/auth/me");
    } catch {
        return null;
    }
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
    const res = await fetch(`${API_BASE}/api/schedules/export`, {
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
    const res = await fetch(`${API_BASE}/api/schedules/export/csv`, {
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
export async function importExcel(file: File): Promise<{ imported: number; errors: string[] }> {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/schedules/import`, {
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

export async function createUser(username: string, password: string, role?: string): Promise<any> {
    return fetchApi("/api/users", {
        method: "POST",
        body: JSON.stringify({ username, password, role }),
    });
}

export async function updateUserRole(id: number, role: string): Promise<any> {
    return fetchApi(`/api/users/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
    });
}

export async function resetUserPassword(id: number, password: string): Promise<any> {
    return fetchApi(`/api/users/${id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password }),
    });
}

export async function deleteUser(id: number): Promise<void> {
    await fetchApi(`/api/users/${id}`, { method: "DELETE" });
}

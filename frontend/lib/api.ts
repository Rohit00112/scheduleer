import { Schedule, ScheduleFilter, AuthResponse } from "./types";

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

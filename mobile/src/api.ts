import type {
  Announcement,
  AuthResponse,
  AuthUser,
  Schedule,
  ScheduleFilter,
} from "./types";

function normalizeBaseUrl(url: string | undefined): string {
  return (url || "").trim().replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
  }

  const headers = new Headers(options.headers || undefined);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const fallbackMessage = `API error: ${response.status} ${response.statusText}`;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message || fallbackMessage);
    }

    const text = await response.text().catch(() => "");
    throw new Error(text || fallbackMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function buildScheduleQuery(filter: ScheduleFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

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

export async function getMe(token: string): Promise<AuthUser | null> {
  try {
    return await fetchApi<AuthUser | null>("/api/auth/me", { method: "GET" }, token);
  } catch {
    return null;
  }
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>(
    "/api/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    },
    token,
  );
}

export async function getSchedules(
  token: string,
  filter: ScheduleFilter = {},
): Promise<Schedule[]> {
  return fetchApi<Schedule[]>(
    `/api/schedules${buildScheduleQuery(filter)}`,
    { method: "GET" },
    token,
  );
}

export async function getAnnouncements(token?: string): Promise<Announcement[]> {
  return fetchApi<Announcement[]>("/api/announcements", { method: "GET" }, token);
}

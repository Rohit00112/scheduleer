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

export interface AuthUser {
  id: number;
  username: string;
  role: "admin" | "user" | "instructor";
  mustChangePassword: boolean;
  instructorName: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Announcement {
  id: number;
  title: string;
  message: string;
  type: "info" | "warning" | "urgent";
  createdBy: string;
  active: boolean;
  createdAt: string;
}

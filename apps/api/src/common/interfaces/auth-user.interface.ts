export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "staff" | "viewer";
  displayName: string;
  preferredWorkspace?: string | null;
  timezone?: string | null;
}

export function workspaceHome(user: {
  role: "admin" | "staff" | "viewer";
  preferredWorkspace?: string | null;
}): string {
  if (user.role === "admin") {
    return "/admin/dashboard";
  }

  return "/portal/my-week";
}

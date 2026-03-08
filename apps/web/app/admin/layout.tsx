"use client";

import { AdminShell } from "../../components/admin-shell";
import { RequireAuth } from "../../components/require-auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["admin"]}>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}

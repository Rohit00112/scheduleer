"use client";

import { PortalShell } from "../../components/portal-shell";
import { RequireAuth } from "../../components/require-auth";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["staff", "viewer"]}>
      <PortalShell>{children}</PortalShell>
    </RequireAuth>
  );
}

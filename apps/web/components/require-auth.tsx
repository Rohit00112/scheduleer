"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import { workspaceHome } from "../lib/workspace";

export function RequireAuth({
  children,
  roles
}: {
  children: React.ReactNode;
  roles?: Array<"admin" | "staff" | "viewer">;
}) {
  const router = useRouter();
  const { token, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!loading && token && user && roles && !roles.includes(user.role)) {
      router.replace(workspaceHome(user));
    }
  }, [loading, token, user, roles, router]);

  if (loading) {
    return <p className="loading">Loading session...</p>;
  }

  if (!token || !user) {
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

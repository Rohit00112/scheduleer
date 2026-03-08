"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-context";
import { workspaceHome } from "../lib/workspace";

export default function HomePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token || !user) {
      router.replace("/login");
      return;
    }

    router.replace(workspaceHome(user));
  }, [loading, token, user, router]);

  return <p className="loading">Routing...</p>;
}

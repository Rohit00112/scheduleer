"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { closeSocket } from "./socket";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    email: string;
    role: "admin" | "staff" | "viewer";
    displayName: string;
    preferredWorkspace?: string | null;
    timezone?: string | null;
  } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const ACCESS_TOKEN_KEY = "schedule.accessToken";
const REFRESH_TOKEN_KEY = "schedule.refreshToken";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    closeSocket();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const loadMe = useCallback(
    async (accessToken: string) => {
      try {
        const me = await apiFetch<AuthState["user"]>("/auth/me", {
          token: accessToken
        });
        setUser(me);
      } catch {
        logout();
      }
    },
    [logout]
  );

  useEffect(() => {
    const existingToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const existingRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!existingToken || !existingRefreshToken) {
      setLoading(false);
      return;
    }

    setToken(existingToken);
    setRefreshToken(existingRefreshToken);

    loadMe(existingToken).finally(() => {
      setLoading(false);
    });
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await apiFetch<{ accessToken: string; refreshToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      setToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);

      await loadMe(data.accessToken);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error("Invalid email or password");
      }
      throw error;
    }
  }, [loadMe]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      refreshToken,
      user,
      loading,
      login,
      logout
    }),
    [token, refreshToken, user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

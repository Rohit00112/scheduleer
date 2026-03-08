"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthUser } from "@/lib/types";
import { login as apiLogin, register as apiRegister, getMe, changePassword as apiChangePassword } from "@/lib/api";

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isAdmin: boolean;
    isInstructor: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            getMe()
                .then((u) => {
                    if (u) setUser(u as AuthUser);
                    else {
                        localStorage.removeItem("token");
                    }
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (username: string, password: string) => {
        const res = await apiLogin(username, password);
        localStorage.setItem("token", res.accessToken);
        setUser(res.user);
    };

    const register = async (username: string, password: string) => {
        const res = await apiRegister(username, password);
        localStorage.setItem("token", res.accessToken);
        setUser(res.user);
    };

    const changePassword = async (currentPassword: string, newPassword: string) => {
        const res = await apiChangePassword(currentPassword, newPassword);
        localStorage.setItem("token", res.accessToken);
        setUser(res.user);
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{ user, loading, isAdmin: user?.role === "admin", isInstructor: user?.role === "instructor", login, register, changePassword, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

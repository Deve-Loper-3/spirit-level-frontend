"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, revokeSession } from "@/lib/api/client";
import type { BackendLoginData, BackendUser } from "@/lib/api/types";
import { isStaffRole } from "./roles";
import { clearClientSession, getAccessToken, getRefreshToken, saveSession } from "./session";

type AuthContextType = {
    user: BackendUser | null;
    isLoading: boolean;
    signIn: (email: string, password: string, remember: boolean) => Promise<BackendUser>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<BackendUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;

        async function restore() {
            try {
                if (!getRefreshToken()) {
                    clearClientSession();
                    return;
                }
                const data = await api<{ user: BackendUser }>("/auth/me");
                const next = data?.user;
                if (!next || !isStaffRole(next.role)) {
                    const refreshToken = getRefreshToken();
                    const accessToken = getAccessToken();
                    clearClientSession();
                    if (accessToken && refreshToken) {
                        await revokeSession(accessToken, refreshToken).catch(() => undefined);
                    }
                    return;
                }
                if (active) setUser(next);
            } catch {
                if (active) clearClientSession();
            } finally {
                if (active) setIsLoading(false);
            }
        }

        restore();
        return () => {
            active = false;
        };
    }, []);

    const signIn = useCallback(async (email: string, password: string, remember: boolean) => {
        const data = await api<BackendLoginData>("/auth/login", {
            method: "POST",
            auth: false,
            body: { email, password },
        });

        if (!data?.user || !data.tokens?.accessToken || !data.tokens.refreshToken) {
            throw new ApiError(500, "Something went wrong. Please try again.");
        }

        if (!isStaffRole(data.user.role)) {
            await revokeSession(data.tokens.accessToken, data.tokens.refreshToken).catch(() => undefined);
            clearClientSession();
            throw new ApiError(403, "This portal is for staff", "FORBIDDEN_ROLE");
        }

        saveSession(data.tokens, data.user, remember);
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(async () => {
        const refreshToken = getRefreshToken();
        try {
            if (refreshToken) {
                await api("/auth/logout", { method: "POST", body: { refreshToken } });
            }
        } catch {
            // Local sign-out still happens when the API is unreachable.
        }
        clearClientSession();
        setUser(null);
        window.location.href = "/login";
    }, []);

    const value = useMemo(
        () => ({ user, isLoading, signIn, logout }),
        [user, isLoading, signIn, logout],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}

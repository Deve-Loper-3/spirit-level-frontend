"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { BackendUser, BackendTokens } from "@/lib/api/types";
import {
    getCurrentUser,
    getAccessToken,
    setClientSession,
    initializeAuth,
    logoutClient,
} from "./authClient";

interface AuthContextType {
    user: BackendUser | null;
    accessToken: string | null;
    isLoading: boolean;
    setSession: (tokens: BackendTokens, user: BackendUser) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    accessToken: null,
    isLoading: true,
    setSession: () => {},
    logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<BackendUser | null>(getCurrentUser());
    const [accessToken, setAccessToken] = useState<string | null>(getAccessToken());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function restore() {
            try {
                const restoredUser = await initializeAuth();
                if (isMounted) {
                    setUser(restoredUser);
                    setAccessToken(getAccessToken());
                }
            } catch {
                if (isMounted) {
                    setUser(null);
                    setAccessToken(null);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        restore();

        return () => {
            isMounted = false;
        };
    }, []);

    function handleSetSession(tokens: BackendTokens, newUser: BackendUser) {
        setClientSession(tokens, newUser);
        setUser(newUser);
        setAccessToken(tokens.accessToken);
    }

    async function handleLogout() {
        setUser(null);
        setAccessToken(null);
        await logoutClient();
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                isLoading,
                setSession: handleSetSession,
                logout: handleLogout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { getRoleHome } from "@/lib/auth/roles";
import { primaryButtonClass, secondaryButtonClass } from "@/components/(auth)/styles";

export default function ForbiddenPage() {
    const { user } = useAuth();
    const role = user?.role || "Unknown";

    return (
        <main className="bg-stripes flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-[480px] rounded-[6px] border border-divider bg-card p-8 text-center text-card-foreground shadow-2xl">
                <h1 className="mb-2 text-2xl font-bold tracking-tight">Access restricted</h1>
                <p className="mb-6 text-sm text-muted">
                    Your role (<span className="font-semibold uppercase text-foreground">{role}</span>) cannot open this page.
                </p>
                <div className="flex flex-col gap-3">
                    <Link href={getRoleHome(role)} className={`${primaryButtonClass} flex items-center justify-center`}>
                        Return to your dashboard
                    </Link>
                    <Link href="/login" className={`${secondaryButtonClass} flex items-center justify-center`}>
                        Sign in with a different account
                    </Link>
                </div>
            </div>
        </main>
    );
}

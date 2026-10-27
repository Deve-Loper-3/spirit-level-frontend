"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

type ConsoleHomeProps = {
    eyebrow: string;
    title: string;
    subtitle: string;
    allow: readonly string[];
};

export default function ConsoleHome({ eyebrow, title, subtitle, allow }: ConsoleHomeProps) {
    const { user, isLoading, logout } = useAuth();
    const router = useRouter();
    const role = user?.role?.toUpperCase() ?? "";
    const allowed = allow.includes(role);

    useEffect(() => {
        if (isLoading) return;
        if (!user) {
            router.replace(`/login?returnUrl=${window.location.pathname}`);
            return;
        }
        if (!allowed) router.replace("/403");
    }, [allowed, isLoading, router, user]);

    if (isLoading || !user || !allowed) {
        return <main className="p-8 text-sm text-muted">Loading…</main>;
    }

    return (
        <main className="mx-auto max-w-5xl p-8">
            <div className="mb-6 flex items-center justify-between border-b border-divider pb-4">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-spirit-green">
                        {eyebrow}
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                    <p className="text-sm text-muted">{subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/console"
                        className="rounded-[6px] border border-divider px-3.5 py-2 text-sm font-medium hover:bg-divider"
                    >
                        Console
                    </Link>
                    <button
                        type="button"
                        onClick={() => void logout()}
                        className="cursor-pointer rounded-[6px] border border-input-border bg-button px-4 py-2 text-sm font-semibold text-button-foreground hover:opacity-90"
                    >
                        Log out
                    </button>
                </div>
            </div>
            <div className="rounded-[6px] border border-divider bg-card p-6 text-card-foreground">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Signed in as</p>
                <p className="mt-1 text-lg font-semibold">{user.fullName}</p>
                <p className="text-sm text-muted">{user.email}</p>
                <p className="mt-3 text-xs text-muted">
                    <span className="font-semibold text-foreground">Role: </span>
                    <span className="font-semibold uppercase text-spirit-green">{user.role}</span>
                    {user.status ? ` · ${user.status}` : ""}
                </p>
            </div>
        </main>
    );
}

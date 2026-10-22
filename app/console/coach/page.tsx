import { redirect } from "next/navigation";
import Link from "next/link";
import { getValidSession, logoutSession } from "@/lib/auth/session";

export default async function CoachPage() {
    const session = await getValidSession();
    if (!session) {
        redirect("/login?returnUrl=/console/coach");
    }

    const { user } = session;
    const role = user.role?.toUpperCase();
    if (role !== "COACH" && role !== "ADMIN" && role !== "OWNER") {
        redirect("/403");
    }

    async function handleLogout() {
        "use server";
        await logoutSession();
        redirect("/login");
    }

    return (
        <main className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between border-b border-divider pb-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="size-2 rounded-full bg-spirit-green" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-spirit-green">
                            Coach Portal
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Staff Coaching Station</h1>
                    <p className="text-sm text-muted">Spirit Level Session Schedules & Athlete Tracking</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/console"
                        className="rounded-[6px] border border-divider px-3.5 py-2 text-sm font-medium hover:bg-divider transition-colors"
                    >
                        General Console
                    </Link>
                    <form action={handleLogout}>
                        <button
                            type="submit"
                            className="rounded-[6px] border border-input-border bg-button px-4 py-2 text-sm font-semibold text-button-foreground transition-opacity hover:opacity-90 cursor-pointer"
                        >
                            Log out
                        </button>
                    </form>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <div className="rounded-[6px] border border-divider p-5 bg-card text-card-foreground">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Access Level</p>
                    <p className="text-2xl font-bold">Staff Coach</p>
                    <p className="text-xs text-muted mt-2">Active training & member coaching</p>
                </div>
                <div className="rounded-[6px] border border-divider p-5 bg-card text-card-foreground">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Authenticated Account</p>
                    <p className="text-lg font-semibold truncate">{user.fullName}</p>
                    <p className="text-xs text-muted truncate mt-1">{user.email}</p>
                </div>
                <div className="rounded-[6px] border border-divider p-5 bg-card text-card-foreground">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Status</p>
                    <p className="text-lg font-semibold uppercase text-spirit-green">{user.status || "Active"}</p>
                    <p className="text-xs text-muted mt-1">Terminal Session Verified</p>
                </div>
            </div>
        </main>
    );
}

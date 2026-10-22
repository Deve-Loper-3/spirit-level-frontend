import { redirect } from "next/navigation";
import Link from "next/link";
import { getValidSession, logoutSession } from "@/lib/auth/session";
import { getRoleHome } from "@/lib/auth/roles";

export default async function ConsolePage() {
    const session = await getValidSession();
    if (!session) {
        redirect("/login?returnUrl=/console");
    }

    const { user } = session;
    const roleHome = getRoleHome(user.role);

    async function handleLogout() {
        "use server";
        await logoutSession();
        redirect("/login");
    }

    return (
        <main className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between border-b border-divider pb-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Console</h1>
                    <p className="text-sm text-muted">Spirit Level Staff Operations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={roleHome}
                        className="rounded-[6px] bg-button px-3.5 py-2 text-sm font-semibold text-button-foreground transition-opacity hover:opacity-90"
                    >
                        Go to {user.role || "Staff"} Home
                    </Link>
                    <form action={handleLogout}>
                        <button
                            type="submit"
                            className="rounded-[6px] border border-input-border bg-transparent px-4 py-2 text-sm font-semibold text-card-foreground transition-colors hover:bg-divider cursor-pointer"
                        >
                            Log out
                        </button>
                    </form>
                </div>
            </div>
            <div className="rounded-[6px] border border-divider p-6 bg-card text-card-foreground space-y-4">
                <div>
                    <p className="text-xs uppercase tracking-wider text-muted font-semibold">Signed in as</p>
                    <p className="text-lg font-medium">{user.fullName || "Staff Member"}</p>
                    <p className="text-sm text-muted">{user.email}</p>
                </div>
                <div className="flex gap-4 pt-2 border-t border-divider text-xs text-muted">
                    <div>
                        <span className="font-semibold text-foreground">Role: </span>
                        <span className="capitalize font-semibold text-spirit-green">{user.role || "Staff"}</span>
                    </div>
                    {user.status && (
                        <div>
                            <span className="font-semibold text-foreground">Status: </span>
                            <span className="capitalize">{user.status}</span>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
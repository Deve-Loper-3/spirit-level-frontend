import { redirect } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth/session";

export default async function ConsolePage() {
    const token = await getSession();
    if (!token) {
        redirect("/login");
    }

    async function handleLogout() {
        "use server";
        await clearSession();
        redirect("/login");
    }

    return (
        <main className="p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between border-b border-divider pb-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Console</h1>
                    <p className="text-sm text-muted">Spirit Level Staff Operations</p>
                </div>
                <form action={handleLogout}>
                    <button
                        type="submit"
                        className="rounded-[6px] border border-input-border bg-button px-4 py-2 text-sm font-semibold text-button-foreground transition-opacity hover:opacity-90 cursor-pointer"
                    >
                        Log out
                    </button>
                </form>
            </div>
            <div className="rounded-[6px] border border-divider p-6 bg-card text-card-foreground">
                <p className="text-sm">You are currently signed in to the staff console.</p>
            </div>
        </main>
    );
}
import Link from "next/link";
import { cookies } from "next/headers";
import { USER_ROLE_COOKIE } from "@/lib/auth/session";
import { getRoleHome } from "@/lib/auth/roles";
import { primaryButtonClass, secondaryButtonClass } from "@/components/(auth)/styles";

export default async function ForbiddenPage() {
    const store = await cookies();
    const role = store.get(USER_ROLE_COOKIE)?.value || "Unknown";
    const homeUrl = getRoleHome(role);

    return (
        <main className="bg-stripes min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-[480px] rounded-[6px] bg-card p-8 text-card-foreground shadow-2xl border border-divider text-center">
                <div
                    aria-hidden="true"
                    className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[#FDF2F1] text-[#B42318]"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>

                <div className="mb-2 inline-block rounded-[4px] bg-[#FDF2F1] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#B42318]">
                    HTTP 403 Forbidden
                </div>

                <h1 className="mb-2 text-2xl font-bold tracking-tight">Access Restricted</h1>
                <p className="mb-6 text-sm text-muted">
                    Your current account role (<span className="font-semibold text-foreground uppercase">{role}</span>) does not have authorization to view this area.
                </p>

                <div className="flex flex-col gap-3">
                    <Link
                        href={homeUrl}
                        className={`${primaryButtonClass} flex items-center justify-center`}
                    >
                        Return to your dashboard
                    </Link>

                    <Link
                        href="/login"
                        className={`${secondaryButtonClass} flex items-center justify-center`}
                    >
                        Sign in with a different account
                    </Link>
                </div>
            </div>
        </main>
    );
}

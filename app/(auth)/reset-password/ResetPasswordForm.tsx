"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/(auth)/PasswordInput";
import {
    labelClass,
    linkButtonClass,
    primaryButtonClass,
} from "@/components/(auth)/styles";
import { passwordProblem, PASSWORD_HINT } from "@/lib/validation/password";
import { api, ApiError } from "@/lib/api/client";
import { clearReset, readReset } from "@/lib/auth/session";

function CheckIcon() {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export default function ResetPasswordForm() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!readReset()) router.replace("/login");
    }, [router]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");

        // Cheap checks first, so we don't hit the network for obvious mistakes.
        if (newPassword !== confirmPassword) {
            setError("Passwords don't match.");
            return;
        }
        const problem = passwordProblem(newPassword);
        if (problem) {
            setError(problem);
            return;
        }

        const reset = readReset();
        if (!reset) {
            router.replace("/login");
            return;
        }

        setIsLoading(true);
        try {
            await api("/auth/reset-password", {
                method: "POST",
                auth: false,
                body: {
                    email: reset.email,
                    resetToken: reset.resetToken,
                    newPassword,
                },
            });
            clearReset();
            setNewPassword("");
            setConfirmPassword("");
            setDone(true);
        } catch (error) {
            setError(
                error instanceof ApiError
                    ? error.message
                    : "We couldn't update your password. Please try again.",
            );
        } finally {
            setIsLoading(false);
        }
    }

    // SUCCESS VIEW (a state on the same page, so no query string or Suspense is needed)
    if (done) {
        return (
            <>
                <div
                    aria-hidden="true"
                    className="mb-[22px] flex size-12 items-center justify-center rounded-[6px] bg-[#EAF3D6] text-[#5F7F16]"
                >
                    <CheckIcon />
                </div>
                <h1 className="mb-2 text-[32px] font-bold leading-[1.05] tracking-tight">
                    Password updated
                </h1>
                <p className="mb-[28px] text-[14px] leading-[1.6] text-muted">
                    You can now sign in with your new password.
                </p>
                {/* A Link styled as a button: flex + centering make the h-* and w-* classes work. */}
                <Link
                    href="/login"
                    className={`${primaryButtonClass} flex items-center justify-center`}
                >
                    Back to sign in
                </Link>
            </>
        );
    }

    return (
        <>
            <div className="mb-[22px] flex w-fit items-center gap-2 rounded-[4px] bg-badge px-3 py-1.5">
                <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full bg-spirit-green"
                />
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white">
                    Staff access
                </span>
            </div>

            <h1 className="mb-2 text-[32px] font-bold leading-[1.05] tracking-tight">
                Set a new password
            </h1>
            <p className="mb-[28px] text-[14px] leading-[1.6] text-muted">
                Choose a new password for your staff account.
            </p>

            {error && (
                <div
                    role="alert"
                    className="mb-5 rounded-[6px] border border-[#F2C4C0] bg-[#FDF2F1] px-3 py-2 text-[13px] text-[#B42318]"
                >
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="mb-[18px]">
                    <label htmlFor="new-password" className={labelClass}>
                        New password
                    </label>
                    {/* new-password tells password managers to offer a strong NEW password. */}
                    <PasswordInput
                        id="new-password"
                        name="newPassword"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                    />
                    <p className="mt-2 text-[12px] text-muted">
                        {PASSWORD_HINT}
                    </p>
                </div>

                <div className="mb-6">
                    <label htmlFor="confirm-password" className={labelClass}>
                        Confirm password
                    </label>
                    <PasswordInput
                        id="confirm-password"
                        name="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className={primaryButtonClass}
                >
                    {isLoading ? "Updating…" : "Update password"}
                </button>
            </form>

            <div className="mt-[22px] border-t border-divider pt-[18px] text-center text-[13px]">
                <Link href="/login" className={linkButtonClass}>
                    Back to sign in
                </Link>
            </div>
        </>
    );
}
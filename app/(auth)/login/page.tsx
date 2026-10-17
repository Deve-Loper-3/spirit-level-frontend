"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/(auth)/PasswordInput";
import OtpInput from "@/components/(auth)/OtpInput";
import {
    inputClass,
    labelClass,
    linkButtonClass,
    primaryButtonClass,
    secondaryButtonClass,
} from "@/components/(auth)/styles";


type View = "signin" | "reset" | "otp";

const OTP_LENGTH = 4;

function MailIcon() {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const [view, setView] = useState<View>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    // showPassword state is gone: PasswordInput owns it now.
    const [remember, setRemember] = useState(false);
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    function goTo(next: View) {
        setError("");
        setView(next);
    }

    async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    email,
                    remember,
                    password
                })
            })
            const data = await res.json() as { message: string }
            if (!res.ok) {
                setError(data.message ?? "Something went wrong. Please try again.");
                setIsLoading(false);
                return;
            }
            router.replace("/console")


        } catch {
            setError("Something went wrong. Please try again.");
            setIsLoading(false);
        }
    }

    // Asks our server to send the code. Returns true if the request was accepted.
    async function requestOtp(): Promise<boolean> {
        setError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = (await res.json()) as { message?: string };
            if (!res.ok) {
                setError(data.message ?? "We couldn't send the code. Please try again.");
                return false;
            }
            return true;
        } catch {
            setError("We couldn't send the code. Please try again.");
            return false;
        } finally {
            setIsLoading(false);
        }
    }

    async function handleReset(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (await requestOtp()) {
            setOtp("");
            goTo("otp");
            startResendCooldown();
        }
    }

    async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, otp }),
            });
            const data = (await res.json()) as { message?: string };
            if (!res.ok) {
                setError(data.message ?? "That code didn't work. Please try again.");
                setIsLoading(false);
                return;
            }
            // TEMPORARY: the real "set a new password" screen will replace this redirect.
            router.replace("/reset-password");
        } catch {
            setError("We couldn't verify the code. Please try again.");
            setIsLoading(false);
        }
    }

    async function handleResend() {
        if (resendCooldown > 0 || isLoading) return;
        if (await requestOtp()) {
            setOtp("");
            startResendCooldown();
        }
    }

    function startResendCooldown(seconds = 30) {
        if (timerRef.current) clearInterval(timerRef.current);
        setResendCooldown(seconds);
        timerRef.current = setInterval(() => {
            setResendCooldown((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    const copy = {
        signin: {
            title: "Sign in to console",
            text: "Use your Spirit Level staff account. Access is logged.",
        },
        reset: {
            title: "Reset your password",
            text: "Enter your staff email and we'll send you an OTP to reset your password.",
        },
        otp: {
            title: "Check your inbox",
            text: `If an account exists for ${email || "that email"}, an OTP is on its way.`,
        },
    }[view];

    // The shell (<main>, logo, card, footer) now lives in (auth)/layout.tsx,
    // so this page returns only what goes inside the card. A fragment groups the siblings.
    return (
        <>
            {view === "otp" ? (
                <div
                    aria-hidden="true"
                    className="mb-[22px] flex size-12 items-center justify-center rounded-[6px] bg-[#EAF3D6] text-link"
                >
                    <MailIcon />
                </div>
            ) : (
                <div className="mb-[22px] flex w-fit items-center gap-2 rounded-[4px] bg-badge px-3 py-1.5">
                    <span
                        aria-hidden="true"
                        className="size-1.5 shrink-0 rounded-full bg-spirit-green"
                    />
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white">
                        Staff access
                    </span>
                </div>
            )}

            <h1 className="mb-2 text-[32px] font-bold leading-[1.05] tracking-tight">
                {copy.title}
            </h1>
            <p className="mb-[28px] text-[14px] leading-[1.6] text-muted">
                {copy.text}
            </p>

            {error && (
                <div
                    role="alert"
                    className="mb-5 rounded-[6px] border border-[#F2C4C0] bg-[#FDF2F1] px-3 py-2 text-[13px] text-[#B42318]"
                >
                    {error}
                </div>
            )}

            {/* VIEW 1: SIGN IN */}
            {view === "signin" && (
                <>
                    <form onSubmit={handleSignIn}>
                        <div className="mb-[18px]">
                            <label htmlFor="email" className={labelClass}>
                                Staff email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                                className={inputClass}
                            />
                        </div>

                        <div className="mb-[18px]">
                            <label htmlFor="password" className={labelClass}>
                                Password
                            </label>
                            <PasswordInput
                                id="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                        </div>

                        <label className="mb-6 flex cursor-pointer items-center gap-3 text-[14px] text-body-text">
                            <span className="relative flex size-[19px] shrink-0">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                    className="peer size-[19px] cursor-pointer appearance-none rounded-[4px] border border-input-border bg-input checked:border-button checked:bg-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                                />
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-button-foreground peer-checked:block"
                                >
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </span>
                            Keep me signed in on this terminal
                        </label>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={primaryButtonClass}
                        >
                            {isLoading ? "Signing in…" : "Sign in"}
                        </button>
                    </form>

                    {/* Sign-up link: a Link styled as a button. It's inline by default, so
           flex + items-center + justify-center make the h-w -classes take effect. */}
                    <Link
                        href="/signup"
                        className={`${secondaryButtonClass} mt-3 flex items-center justify-center`}
                    >
                        Create an account
                    </Link>

                    <div className="mt-[22px] border-t border-divider pt-[18px] text-center text-[13px] text-muted">
                        Forgot your password?{" "}
                        <button
                            type="button"
                            onClick={() => goTo("reset")}
                            className={linkButtonClass}
                        >
                            Reset it
                        </button>
                    </div>
                </>
            )}

            {/* VIEW 2: RESET FORM */}
            {view === "reset" && (
                <>
                    <form onSubmit={handleReset}>
                        <div className="mb-6">
                            <label htmlFor="reset-email" className={labelClass}>
                                Staff email
                            </label>
                            <input
                                type="email"
                                id="reset-email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                                className={inputClass}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={primaryButtonClass}
                        >
                            {isLoading ? "Sending…" : "Send OTP"}
                        </button>
                    </form>

                    <div className="mt-[22px] border-t border-divider pt-[18px] text-center text-[13px]">
                        <button
                            type="button"
                            onClick={() => goTo("signin")}
                            className={linkButtonClass}
                        >
                            Back to sign in
                        </button>
                    </div>
                </>
            )}

            {/* VIEW 3: CONFIRMATION */}
            {view === "otp" && (
                <>
                    <form onSubmit={handleVerify}>
                        <div className="mb-6">
                            <label className={labelClass}>
                                One-time code
                            </label>
                            <OtpInput
                                length={OTP_LENGTH}
                                value={otp}
                                onChange={setOtp}
                                disabled={isLoading}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || otp.length !== OTP_LENGTH}
                            className={`${primaryButtonClass} ${otp.length !== OTP_LENGTH ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {isLoading ? "Verifying…" : "Verify code"}
                        </button>
                    </form>

                    <div className="mt-[22px] border-t border-divider pt-[18px] text-center text-[13px] text-muted">
                        Didn&apos;t get it?{" "}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={isLoading || resendCooldown > 0}
                            className={`${linkButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                        </button>
                        {" · "}
                        <button
                            type="button"
                            onClick={() => goTo("signin")}
                            className={linkButtonClass}
                        >
                            Back to sign in
                        </button>
                    </div>
                </>
            )}
        </>
    );
}
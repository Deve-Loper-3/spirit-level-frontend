"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/(auth)/PasswordInput";
import OtpInput from "@/components/(auth)/OtpInput";
import {
    inputBase,
    labelClass,
    linkButtonClass,
    primaryButtonClass,
} from "@/components/(auth)/styles";
import {
    validateLoginEmail,
    validateLoginPassword,
    validateLoginForm,
    mapBackendFieldErrors,
    type LoginFieldErrors,
} from "@/lib/validation/auth";
import { setClientSession } from "@/lib/auth/authClient";
import { getRoleHome, isRouteAllowedForRole } from "@/lib/auth/roles";
import type { BackendTokens, BackendUser, ApiFieldError } from "@/lib/api/types";

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

function Spinner() {
    return (
        <svg
            className="mr-2 size-4 animate-spin text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

interface ApiErrorState {
    message: string;
    code?: string;
    isRegistrationIncomplete?: boolean;
    isAccountDisabled?: boolean;
}

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [view, setView] = useState<View>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
    const [apiError, setApiError] = useState<ApiErrorState | null>(null);
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isOtpLockedOut, setIsOtpLockedOut] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const emailInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    const registeredParam = searchParams.get("registered");
    const isPendingApproval = registeredParam === "pending";
    const isRegistered = registeredParam === "true";

    // Query messages from Ticket 1 and Ticket 2
    const queryMessage = searchParams.get("message");
    const queryError = searchParams.get("error");
    const returnUrl = searchParams.get("returnUrl");

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    function goTo(next: View) {
        setApiError(null);
        setFieldErrors({});
        if (next !== "otp") {
            setIsOtpLockedOut(false);
        }
        setView(next);
    }

    // Inline field validation handlers
    function handleEmailBlur() {
        const error = validateLoginEmail(email);
        setFieldErrors((prev) => ({ ...prev, email: error }));
    }

    function handlePasswordBlur() {
        const error = validateLoginPassword(password);
        setFieldErrors((prev) => ({ ...prev, password: error }));
    }

    function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEmail(e.target.value);
        if (fieldErrors.email) {
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
        }
    }

    function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
        setPassword(e.target.value);
        if (fieldErrors.password) {
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
        }
    }

    async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setApiError(null);

        // 1. Client-side validation on submit
        const validation = validateLoginForm(email, password);
        if (!validation.isValid) {
            setFieldErrors(validation.errors);
            if (validation.errors.email) {
                emailInputRef.current?.focus();
            } else if (validation.errors.password) {
                passwordInputRef.current?.focus();
            }
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: validation.sanitized.email,
                    password: validation.sanitized.password,
                    remember,
                }),
            });

            const data = (await res.json()) as {
                message?: string;
                code?: string;
                errors?: ApiFieldError[];
                user?: BackendUser;
                tokens?: BackendTokens;
            };

            if (!res.ok) {
                // Map API field errors if present
                if (Array.isArray(data.errors) && data.errors.length > 0) {
                    setFieldErrors(mapBackendFieldErrors(data.errors));
                }

                // Ticket 3 API error handling
                if (res.status === 401 || data.code === "INVALID_CREDENTIALS") {
                    // Show API message without highlighting a specific field
                    setApiError({
                        message: data.message || "Invalid email or password",
                        code: data.code || "INVALID_CREDENTIALS",
                    });
                } else if (res.status === 403 && data.code === "REGISTRATION_INCOMPLETE") {
                    setApiError({
                        message: data.message || "Registration incomplete.",
                        code: data.code,
                        isRegistrationIncomplete: true,
                    });
                } else if (res.status === 403 && data.code === "ACCOUNT_DISABLED") {
                    setApiError({
                        message: data.message || "Your account has been disabled. Please contact support.",
                        code: data.code,
                        isAccountDisabled: true,
                    });
                } else if (res.status === 403 && data.code === "FORBIDDEN_ROLE") {
                    setApiError({
                        message: "This portal is for staff",
                        code: data.code,
                    });
                } else if (res.status === 429) {
                    setApiError({
                        message: "Too many attempts. Please try again later.",
                        code: "RATE_LIMITED",
                    });
                } else {
                    setApiError({
                        message: data.message || "Something went wrong. Please try again.",
                        code: data.code,
                    });
                }
                return;
            }

            // Success: configure client session
            if (data.tokens && data.user) {
                try {
                    setClientSession(data.tokens, data.user);
                } catch {
                    setApiError({ message: "This portal is for staff" });
                    return;
                }

                // Ticket 2: Role redirect / returnUrl check
                const userRole = data.user.role;
                if (
                    returnUrl &&
                    returnUrl.startsWith("/") &&
                    !returnUrl.startsWith("//") &&
                    isRouteAllowedForRole(returnUrl, userRole)
                ) {
                    router.replace(returnUrl);
                } else {
                    router.replace(getRoleHome(userRole));
                }
            } else {
                router.replace("/console");
            }
        } catch {
            setApiError({ message: "Network error: backend service unavailable." });
        } finally {
            setIsLoading(false);
        }
    }

    async function requestOtp(): Promise<boolean> {
        setApiError(null);
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            const data = (await res.json()) as { message?: string };
            if (!res.ok) {
                setApiError({ message: data.message ?? "We couldn't send the code. Please try again." });
                return false;
            }
            setIsOtpLockedOut(false);
            return true;
        } catch {
            setApiError({ message: "We couldn't send the code. Please try again." });
            return false;
        } finally {
            setIsLoading(false);
        }
    }

    async function handleReset(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const emailErr = validateLoginEmail(email);
        if (emailErr) {
            setFieldErrors({ email: emailErr });
            emailInputRef.current?.focus();
            return;
        }
        if (await requestOtp()) {
            setOtp("");
            goTo("otp");
            startResendCooldown();
        }
    }

    async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isOtpLockedOut) return;
        setApiError(null);
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
            });
            const data = (await res.json()) as { message?: string; remainingAttempts?: number };
            if (!res.ok) {
                setApiError({ message: data.message ?? "That code didn't work. Please try again." });
                if (res.status === 429 || data.remainingAttempts === 0) {
                    setIsOtpLockedOut(true);
                    setOtp("");
                }
                return;
            }
            router.replace("/reset-password");
        } catch {
            setApiError({ message: "We couldn't verify the code. Please try again." });
        } finally {
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

    return (
        <div className="w-full min-w-[280px]">
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

            {/* Session Ended notification from Ticket 1 */}
            {queryMessage && !apiError && view === "signin" && (
                <div
                    role="alert"
                    className="mb-5 rounded-[6px] border border-[#F2C4C0] bg-[#FDF2F1] px-3.5 py-2.5 text-[13px] text-[#B42318]"
                >
                    {queryMessage}
                </div>
            )}

            {/* Member Refusal notification from Ticket 2 */}
            {queryError === "member_refused" && !apiError && view === "signin" && (
                <div
                    role="alert"
                    className="mb-5 rounded-[6px] border border-[#F2C4C0] bg-[#FDF2F1] px-3.5 py-2.5 text-[13px] text-[#B42318]"
                >
                    This portal is for staff
                </div>
            )}

            {isPendingApproval && view === "signin" && !apiError && !queryMessage && (
                <div
                    role="status"
                    className="mb-5 rounded-[6px] border border-[#BDEBA0] bg-[#F4FBEA] px-3 py-2.5 text-[13px] text-[#2F6114]"
                >
                    <span className="font-semibold block mb-0.5">Registration submitted</span>
                    Your coach account has been registered and is pending administrator activation. You will be able to sign in once an administrator approves your account.
                </div>
            )}

            {isRegistered && !isPendingApproval && view === "signin" && !apiError && !queryMessage && (
                <div
                    role="status"
                    className="mb-5 rounded-[6px] border border-[#BDEBA0] bg-[#F4FBEA] px-3 py-2 text-[13px] text-[#2F6114]"
                >
                    Account created successfully. Please sign in below.
                </div>
            )}

            {/* API Errors Banner */}
            {apiError && (
                <div
                    role="alert"
                    className="mb-5 rounded-[6px] border border-[#F2C4C0] bg-[#FDF2F1] px-3.5 py-2.5 text-[13px] text-[#B42318]"
                >
                    <span>{apiError.message}</span>
                    {apiError.isRegistrationIncomplete && (
                        <div className="mt-1">
                            <Link
                                href="/signup"
                                className="font-semibold underline underline-offset-2 hover:opacity-90 inline-block min-h-[44px] leading-[44px]"
                            >
                                Finish sign-up &rarr;
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 1: SIGN IN */}
            {view === "signin" && (
                <>
                    <form onSubmit={handleSignIn} noValidate>
                        <div className="mb-[18px]">
                            <label htmlFor="email" className={labelClass}>
                                Staff email
                            </label>
                            <input
                                ref={emailInputRef}
                                type="email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={handleEmailChange}
                                onBlur={handleEmailBlur}
                                autoComplete="email"
                                maxLength={254}
                                required
                                aria-required="true"
                                aria-invalid={Boolean(fieldErrors.email)}
                                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                                className={`${inputBase} px-[15px] ${
                                    fieldErrors.email
                                        ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]"
                                        : ""
                                }`}
                            />
                            {fieldErrors.email && (
                                <p
                                    id="email-error"
                                    role="alert"
                                    className="mt-1.5 text-[12px] text-[#B42318]"
                                >
                                    {fieldErrors.email}
                                </p>
                            )}
                        </div>

                        <div className="mb-[18px]">
                            <div className="flex items-center justify-between mb-2">
                                <label htmlFor="password" className={labelClass.replace("mb-2 ", "")}>
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => goTo("reset")}
                                    className="text-[12px] font-semibold text-link underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-focus cursor-pointer"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <PasswordInput
                                id="password"
                                name="password"
                                value={password}
                                onChange={handlePasswordChange}
                                onBlur={handlePasswordBlur}
                                autoComplete="current-password"
                                maxLength={72}
                                ariaInvalid={Boolean(fieldErrors.password)}
                                ariaDescribedBy={fieldErrors.password ? "password-error" : undefined}
                                hasError={Boolean(fieldErrors.password)}
                                disabled={isLoading}
                            />
                            {fieldErrors.password && (
                                <p
                                    id="password-error"
                                    role="alert"
                                    className="mt-1.5 text-[12px] text-[#B42318]"
                                >
                                    {fieldErrors.password}
                                </p>
                            )}
                        </div>

                        <label className="mb-6 flex min-h-[44px] cursor-pointer items-center gap-3 text-[14px] text-body-text">
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
                            className={`${primaryButtonClass} flex items-center justify-center`}
                        >
                            {isLoading ? (
                                <>
                                    <Spinner />
                                    <span>Signing in…</span>
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </button>
                    </form>

                    <div className="mt-5 text-center text-[13px] text-muted">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/signup"
                            className={`${linkButtonClass} inline-flex min-h-[44px] items-center`}
                        >
                            Sign up
                        </Link>
                    </div>
                </>
            )}

            {/* VIEW 2: RESET FORM */}
            {view === "reset" && (
                <>
                    <form onSubmit={handleReset} noValidate>
                        <div className="mb-6">
                            <label htmlFor="reset-email" className={labelClass}>
                                Staff email
                            </label>
                            <input
                                ref={emailInputRef}
                                type="email"
                                id="reset-email"
                                name="email"
                                value={email}
                                onChange={handleEmailChange}
                                onBlur={handleEmailBlur}
                                autoComplete="email"
                                maxLength={254}
                                required
                                aria-required="true"
                                aria-invalid={Boolean(fieldErrors.email)}
                                aria-describedby={fieldErrors.email ? "reset-email-error" : undefined}
                                className={`${inputBase} px-[15px] ${
                                    fieldErrors.email
                                        ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]"
                                        : ""
                                }`}
                            />
                            {fieldErrors.email && (
                                <p
                                    id="reset-email-error"
                                    role="alert"
                                    className="mt-1.5 text-[12px] text-[#B42318]"
                                >
                                    {fieldErrors.email}
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`${primaryButtonClass} flex items-center justify-center`}
                        >
                            {isLoading ? (
                                <>
                                    <Spinner />
                                    <span>Sending…</span>
                                </>
                            ) : (
                                "Send OTP"
                            )}
                        </button>
                    </form>

                    <div className="mt-[22px] border-t border-divider pt-[18px] text-center text-[13px]">
                        <button
                            type="button"
                            onClick={() => goTo("signin")}
                            className={`${linkButtonClass} inline-flex min-h-[44px] items-center cursor-pointer`}
                        >
                            Back to sign in
                        </button>
                    </div>
                </>
            )}

            {/* VIEW 3: OTP CONFIRMATION */}
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
                                disabled={isLoading || isOtpLockedOut}
                            />
                            {isOtpLockedOut && (
                                <p className="mt-2 text-[12px] text-[#B42318]">
                                    Verification locked. Please click &ldquo;Resend&rdquo; below to request a new code.
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || isOtpLockedOut || otp.length !== OTP_LENGTH}
                            className={`${primaryButtonClass} flex items-center justify-center ${
                                otp.length !== OTP_LENGTH || isOtpLockedOut
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <Spinner />
                                    <span>Verifying…</span>
                                </>
                            ) : isOtpLockedOut ? (
                                "Verification locked"
                            ) : (
                                "Verify code"
                            )}
                        </button>
                    </form>

                    <div className="mt-[22px] border-t border-divider pt-[18px] text-center text-[13px] text-muted flex items-center justify-center gap-2">
                        <span>Didn&apos;t get it?</span>
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={isLoading || resendCooldown > 0}
                            className={`${linkButtonClass} inline-flex min-h-[44px] items-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                        >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                        </button>
                        <span>·</span>
                        <button
                            type="button"
                            onClick={() => goTo("signin")}
                            className={`${linkButtonClass} inline-flex min-h-[44px] items-center cursor-pointer`}
                        >
                            Back to sign in
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}
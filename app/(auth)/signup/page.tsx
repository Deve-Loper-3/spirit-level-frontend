import type { Metadata } from "next";
import Link from "next/link";
import SignUpForm from "./signUpForm";
import { linkButtonClass } from "@/components/(auth)/styles";

// Allowed here because this file is a Server Component (no "use client").
// That's the reason the interactive form lives in a separate client file.
export const metadata: Metadata = {
    title: "Create account · Spirit Level Staff Console",
};

export default function SignUpPage() {
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

            {/* Heading and supporting text are placeholder copy: the design has no sign-up screen. */}
            <h1 className="mb-2 text-[32px] font-bold leading-[1.05] tracking-tight">
                Create your account
            </h1>
            <p className="mb-[28px] text-[14px] leading-[1.6] text-muted">
                Enter your details to request staff access. Access is logged.
            </p>

            <SignUpForm />

            <div className="mt-[22px] border-t border-divider pt-[18px] text-center text-[13px] text-muted">
                Already have an account?{" "}
                {/* A Link styled as a link: it navigates, so it's a Link and not a button. */}
                <Link href="/login" className={linkButtonClass}>
                    Sign in
                </Link>
            </div>
        </>
    );
}
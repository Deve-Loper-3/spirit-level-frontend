import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ResetPasswordForm from "./ResetPasswordForm";
import { getResetToken } from "@/lib/auth/reset";

// Allowed here because this is a Server Component.
export const metadata: Metadata = {
    title: "Set a new password · Spirit Level Staff Console",
};

export default async function ResetPasswordPage() {
    // A courtesy check only: it saves people from a form that can't work.
    // The BACKEND is what really enforces the proof, because anyone can edit cookies.
    // redirect() works by throwing, so never put it inside try/catch.
    if (!(await getResetToken())) {
        redirect("/login");
    }

    return <ResetPasswordForm />;
}
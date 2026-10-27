import type { Metadata } from "next";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
    title: "Set a new password · Spirit Level Staff Console",
};

export default function ResetPasswordPage() {
    return <ResetPasswordForm />;
}

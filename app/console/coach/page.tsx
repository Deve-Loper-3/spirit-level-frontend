"use client";

import ConsoleHome from "@/components/console/ConsoleHome";

const ALLOW = ["OWNER", "ADMIN", "COACH"];

export default function CoachPage() {
    return (
        <ConsoleHome
            eyebrow="Coach"
            title="Staff Coaching Station"
            subtitle="Spirit Level Session Schedules & Athlete Tracking"
            allow={ALLOW}
        />
    );
}

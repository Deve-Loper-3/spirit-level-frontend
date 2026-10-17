import { NextResponse } from "next/server";
import { BackendError, registerUser } from "@/lib/api/backend";
import {
    GENDERS,
    type BackendRegisterRequest,
    type Gender,
} from "@/lib/api/types";

// A type guard: true only for non-empty strings, and it tells TypeScript so.
function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
    // 1. Parse the browser's JSON. Never trust it: the body can be malformed, or anyone
    //    can call this URL directly and skip your form's validation entirely.
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { message: "Invalid request body." },
            { status: 400 },
        );
    }
    if (typeof body !== "object" || body === null) {
        return NextResponse.json(
            { message: "Invalid request body." },
            { status: 400 },
        );
    }

    // 2. Read ONLY the fields we expect. Anything else the caller sends, including
    //    "role", is ignored here, so it can never reach the backend.
    const { firstName, lastName, email, phone, gender, password, dob, whatsappNumber } = body;

    if (
        !isText(firstName) ||
        !isText(lastName) ||
        !isText(email) ||
        !isText(phone) ||
        !isText(gender) ||
        !isText(password)
    ) {
        return NextResponse.json(
            { message: "Please fill in all required fields." },
            { status: 400 },
        );
    }

    if (password.length < 8) {
        return NextResponse.json(
            { message: "Password must be at least 8 characters." },
            { status: 400 },
        );
    }

    if (!(GENDERS as readonly string[]).includes(gender)) {
        return NextResponse.json({ message: "Invalid gender." }, { status: 400 });
    }

    // 3. Date of birth: "YYYY-MM-DD" -> day and month numbers (the backend stores no year).
    //    We split the string instead of using new Date(), which can shift the date
    //    by a day depending on the timezone.
    let birthDay: number | undefined;
    let birthMonth: number | undefined;
    if (isText(dob)) {
        const [, month, day] = dob.split("-").map(Number);
        if (
            !Number.isInteger(month) ||
            !Number.isInteger(day) ||
            month < 1 ||
            month > 12 ||
            day < 1 ||
            day > 31
        ) {
            return NextResponse.json(
                { message: "Invalid date of birth." },
                { status: 400 },
            );
        }
        birthDay = day;
        birthMonth = month;
    }

    // 4. Translate the FORM's shape into the BACKEND's shape.
    const payload: BackendRegisterRequest = {
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        phone: phone.trim(),
        gender: gender as Gender, // safe: checked against GENDERS above
        password, // never trim a password: spaces may be intentional. Never log it either.
        ...(isText(whatsappNumber) ? { whatsappNumber: whatsappNumber.trim() } : {}),
        // ASSUMPTION: if the real backend rejects these two fields, delete this line.
        ...(birthDay && birthMonth ? { birthDay, birthMonth } : {}),
    };

    // 5. Call the backend and translate the outcome for the browser.
    try {
        const user = await registerUser(payload);
        // Send back only what the browser needs, not the whole user object.
        return NextResponse.json(
            { message: "Registration successful.", status: user.status },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof BackendError) {
            return NextResponse.json(
                { message: error.message },
                { status: error.status },
            );
        }
        // A bug on our side (such as a missing env var): log it for you, keep the user's message generic.
        console.error("Register route failed:", error);
        return NextResponse.json(
            { message: "Something went wrong. Please try again." },
            { status: 500 },
        );
    }
}
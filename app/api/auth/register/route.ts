import { NextResponse } from "next/server";
import { BackendError, registerUser } from "@/lib/api/backend";
import {
    GENDERS,
    type BackendRegisterRequest,
    type Gender,
} from "@/lib/api/types";
import { isText } from "@/lib/validation/request";
import { passwordProblem } from "@/lib/validation/password";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
    // 0. Rate limiting: 50 registration attempts per hour per IP
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`register:${clientIp}`, 50, 60 * 60);
    if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.retryAfterSeconds);
    }

    // 1. Parse and validate JSON body
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

    // 2. Destructure and validate required fields
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

    const problem = passwordProblem(password);
    if (problem) {
        return NextResponse.json(
            { message: problem },
            { status: 400 },
        );
    }

    if (!(GENDERS as readonly string[]).includes(gender)) {
        return NextResponse.json({ message: "Invalid gender." }, { status: 400 });
    }

    // 3. Date of birth formatting: "YYYY-MM-DD" -> day and month
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

    // 4. Construct payload for backend, assigning role as "coach"
    const payload: BackendRegisterRequest = {
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        phone: phone.trim(),
        gender: gender as Gender,
        password,
        role: "coach",
        ...(isText(whatsappNumber) ? { whatsappNumber: whatsappNumber.trim() } : {}),
        ...(birthDay && birthMonth ? { birthDay, birthMonth } : {}),
    };

    // 5. Call backend
    try {
        const user = await registerUser(payload);
        return NextResponse.json(
            {
                message: "Registration submitted successfully. Your account is pending administrator activation.",
                status: user.status,
            },
            { status: 201 },
        );
    } catch (error) {
        if (error instanceof BackendError) {
            return NextResponse.json(
                { message: error.message },
                { status: error.status },
            );
        }
        console.error("Register route failed:", error);
        return NextResponse.json(
            { message: "Something went wrong. Please try again." },
            { status: 500 },
        );
    }
}
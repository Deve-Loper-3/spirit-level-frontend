import type { ApiFieldError } from "@/lib/api/types";

export type LoginFieldErrors = {
    email?: string;
    password?: string;
};

/**
 * RFC 5322 compliant regex for standard email validation.
 */
export const EMAIL_FORMAT_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates email field according to Ticket 3 criteria:
 * - Email is required
 * - Trimmed, lowercased
 * - At most 254 characters
 * - Valid format
 */
export function validateLoginEmail(rawEmail: string): string | undefined {
    const trimmed = rawEmail.trim();
    if (!trimmed) {
        return "Email is required.";
    }
    if (trimmed.length > 254) {
        return "Email must be at most 254 characters.";
    }
    if (!EMAIL_FORMAT_REGEX.test(trimmed)) {
        return "Please enter a valid email address.";
    }
    return undefined;
}

/**
 * Validates password field according to Ticket 3 criteria:
 * - Password is required
 * - 1–72 characters
 * - No strength rules on login
 */
export function validateLoginPassword(rawPassword: string): string | undefined {
    if (!rawPassword) {
        return "Password is required.";
    }
    if (rawPassword.length < 1) {
        return "Password is required.";
    }
    if (rawPassword.length > 72) {
        return "Password must be at most 72 characters.";
    }
    return undefined;
}

/**
 * Validates the entire login form, returning a map of field errors.
 */
export function validateLoginForm(
    email: string,
    password: string,
): {
    isValid: boolean;
    errors: LoginFieldErrors;
    sanitized: { email: string; password: string };
} {
    const emailError = validateLoginEmail(email);
    const passwordError = validateLoginPassword(password);

    const errors: LoginFieldErrors = {};
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;

    return {
        isValid: !emailError && !passwordError,
        errors,
        sanitized: {
            email: email.trim().toLowerCase(),
            password,
        },
    };
}

/**
 * Maps backend errors array [{ field, message }] onto field error records.
 */
export function mapBackendFieldErrors(
    apiErrors?: ApiFieldError[],
): LoginFieldErrors {
    const fieldErrors: LoginFieldErrors = {};
    if (!Array.isArray(apiErrors)) return fieldErrors;

    for (const err of apiErrors) {
        if (!err.field || !err.message) continue;
        const normalized = err.field.toLowerCase();
        if (normalized === "email") {
            fieldErrors.email = err.message;
        } else if (normalized === "password") {
            fieldErrors.password = err.message;
        }
    }
    return fieldErrors;
}

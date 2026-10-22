/**
 * Confirmed password policy:
 * - At least 8 characters
 * - At least one letter
 * - At least one digit
 */
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

export function passwordProblem(password: string): string {
    if (
        password.length < 8 ||
        !/[A-Za-z]/.test(password) ||
        !/\d/.test(password)
    ) {
        return PASSWORD_HINT;
    }
    return "";
}
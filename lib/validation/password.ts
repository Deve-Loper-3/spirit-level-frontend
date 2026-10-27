/** Matches SL-backend password policy. The API is what enforces it. */
export const PASSWORD_HINT =
    "At least 8 characters, with an uppercase letter, a lowercase letter, and a number.";

export function passwordProblem(password: string): string {
    if (password.length > 72 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        return PASSWORD_HINT;
    }
    return "";
}

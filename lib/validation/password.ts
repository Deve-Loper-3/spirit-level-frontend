// One place for the password rules, shared by the browser form AND the server route.
// It uses no server-only code, so both sides can import it.
// ASSUMPTION: these rules are guessed from the sample "Pass1234". Confirm the real ones,
// then change them here and every user of this function follows.
export function passwordProblem(password: string): string {
    if (
        password.length < 8 ||
        !/[A-Za-z]/.test(password) ||
        !/\d/.test(password)
    ) {
        return "Password must be at least 8 characters with a letter and a number.";
    }
    return "";
}
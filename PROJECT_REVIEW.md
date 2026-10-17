# Full Project Codebase Review & Audit Report

**Project:** `sl-app` (Spirit Level Staff Console)  
**Date:** October 2026  
**Status:** Post-OTP Flow Implementation  
**Target:** Documentation of all bugs, logic flaws, security vulnerabilities, and architectural improvements without modifying project code.

---

## 1. Executive Summary

This report covers a comprehensive audit of the entire `sl-app` application, including the newly added Password Reset & OTP verification flows (`/api/auth/forgot-password`, `/api/auth/verify-otp`, `OtpInput.tsx`, and `backend.ts`).

While the UI presentation and styling are modern, clean, and well-tokenized, several **critical runtime bugs, unhandled loading states, security gaps, and data corruption issues** were discovered across both existing and recently added modules.

---

## 2. Critical Bugs (Immediate Attention Required)

### 2.1 Infinite Loading Lock on Failed Login
- **File:** [app/(auth)/login/page.tsx](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L56-L82)
- **Code:**
  ```ts
  const data = await res.json() as { message: string }
  if (!res.ok) {
      setError(data.message ?? "Something went wrong. Please try again.");
      return; // <-- BUG: setIsLoading(false) is never called!
  }
  ```
- **Problem:** If a user enters invalid credentials or the login endpoint responds with an error (HTTP 400/401/403/500), the function returns immediately without resetting `isLoading`.
- **User Impact:** The submit button gets permanently stuck in `"Signing in…"` and `disabled={true}`. The user cannot correct their password or retry without manually refreshing the browser.
- **Fix:** Wrap the fetch in a `finally { setIsLoading(false); }` block or call `setIsLoading(false)` prior to `return`.

---

### 2.2 Registration Form Overwrites Primary Phone Number with WhatsApp Number
- **Files:** [app/(auth)/signup/signUpForm.tsx](file:///d:/Internship/sl-app/app/(auth)/signup/signUpForm.tsx#L106-L108) & [app/api/auth/register/route.ts](file:///d:/Internship/sl-app/app/api/auth/register/route.ts#L36-L89)
- **Code in `signUpForm.tsx`:**
  ```ts
  phone: whatsappSameAsPhone ? values.phoneNum : values.whatsappNum,
  ```
- **Code in `register/route.ts`:**
  ```ts
  const { firstName, lastName, email, phone, gender, password, dob } = body;
  // whatsappNumber is never extracted from body or passed into BackendRegisterRequest!
  ```
- **Problem:** 
  1. When a user selects "Other" for WhatsApp, `values.phoneNum` is discarded and replaced with `values.whatsappNum`. The user's actual phone number is completely lost.
  2. The field `whatsappNumber` is never sent in the POST request body.
  3. The API route does not extract or forward `whatsappNumber` to the backend payload, even though `BackendRegisterRequest` in `types.ts` defines `whatsappNumber?: string`.
- **User Impact:** User phone records become corrupted or swapped with WhatsApp numbers, and dedicated WhatsApp numbers are never recorded.

---

### 2.3 Unprotected Console Route & Missing Auth Middleware
- **File:** [app/console/page.tsx](file:///d:/Internship/sl-app/app/console/page.tsx)
- **Problem:**
  There is no route guard, server-side session check, or Next.js `middleware.ts`. Any unauthenticated user can directly visit `/console`.
- **Security Impact:** Confidential console pages can be viewed without logging in.
- **Fix:** Add a Next.js `middleware.ts` or read session cookies in `console/page.tsx` with a redirect:
  ```ts
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_COOKIE)?.value) {
      redirect("/login");
  }
  ```

---

### 2.4 Unmounted Component Memory Leak in `startResendCooldown`
- **File:** [app/(auth)/login/page.tsx](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L144-L153)
- **Code:**
  ```ts
  function startResendCooldown(seconds = 30) {
      setResendCooldown(seconds);
      const id = setInterval(() => {
          setResendCooldown((prev) => {
              if (prev <= 1) { clearInterval(id); return 0; }
              return prev - 1;
          });
      }, 1000);
  }
  ```
- **Problem:** The `setInterval` ID is not retained in a `useRef` and has no `useEffect` cleanup.
- **Impact:** If the user switches views (e.g., clicks "Back to sign in") or navigates away while the timer is running, the interval continues ticking and updating unmounted React state, causing memory leaks and React warnings. If triggered multiple times, intervals stack and count down erratically.

---

## 3. Backend, API & Data Handling Issues

### 3.1 Untrimmed Parameters in `verify-otp/route.ts`
- **File:** [app/api/auth/verify-otp/route.ts](file:///d:/Internship/sl-app/app/api/auth/verify-otp/route.ts#L25-L37)
- **Code:**
  ```ts
  const { email, otp } = body;
  ...
  await verifyOtp(email, otp);
  ```
- **Problem:** While `forgot-password/route.ts` trims the email (`email.trim()`), `verify-otp/route.ts` forwards the raw `email` and `otp` without trimming. If a user's browser auto-completes email with a trailing space, verification fails.
- **Fix:** Change to `await verifyOtp(email.trim(), otp.trim());`.

---

### 3.2 Lost Reset Token in OTP Verification Flow
- **Files:** [lib/api/backend.ts](file:///d:/Internship/sl-app/lib/api/backend.ts#L76-L78) & [app/(auth)/login/page.tsx](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L131-L134)
- **Problem:**
  `verifyOtp` is typed to return `Promise<void>`:
  ```ts
  export async function verifyOtp(email: string, otp: string): Promise<void>
  ```
  In real authentication backends, verifying an OTP returns a temporary `resetToken` or ticket required by the subsequent `reset-password` endpoint. By returning `void`, any token returned by the backend in `result.data` is discarded.
- **Fix:** Update `verifyOtp` to return `{ resetToken: string }` (or the backend's token payload) and pass it along to the next step.

---

### 3.3 Dead Import from Node.js `dns` Module
- **File:** [lib/api/backend.ts](file:///d:/Internship/sl-app/lib/api/backend.ts#L4)
- **Code:**
  ```ts
  import { promises } from "dns";
  ```
- **Problem:** Unused import pulling the Node `dns` package into the bundle scope.
- **Fix:** Delete line 4.

---

### 3.4 Top-Level `console.log` in Register Route
- **File:** [app/api/auth/register/route.ts](file:///d:/Internship/sl-app/app/api/auth/register/route.ts#L14)
- **Code:**
  ```ts
  console.log("Post route was hit");
  ```
- **Problem:** Placed outside the `POST` function at module scope. Runs once when Node loads the route file, not on incoming requests.
- **Fix:** Move inside the `POST` function or remove.

---

### 3.5 Typo in Type Declaration `ApiSucces`
- **Files:** [lib/api/types.ts](file:///d:/Internship/sl-app/lib/api/types.ts#L1) & [lib/api/backend.ts](file:///d:/Internship/sl-app/lib/api/backend.ts#L3)
- **Code:**
  ```ts
  export type ApiSucces<T> = { ... }
  ```
- **Problem:** Spelling error (`ApiSucces` instead of `ApiSuccess`).

---

### 3.6 Session Cookie Wrapper Type & Typo in `session.ts`
- **File:** [lib/auth/session.ts](file:///d:/Internship/sl-app/lib/auth/session.ts#L21)
- **Code:**
  ```ts
  export async function setSession(tokens: BackendTokens, remeber: Boolean)
  ```
- **Problem:**
  1. Parameter typo: `remeber` instead of `remember`.
  2. Type annotation uses the JavaScript object wrapper `Boolean` instead of the TypeScript primitive `boolean`.
  3. Refresh cookie path is restricted to `path: "/api/auth"`, meaning refresh cookies cannot be read or rotated from other API endpoints.
  4. Missing `getSession()` and `clearSession()` (logout) helpers.

---

## 4. User Experience & Interface Flaws

### 4.1 Incomplete Post-Registration UX
- **File:** [app/(auth)/signup/signUpForm.tsx](file:///d:/Internship/sl-app/app/(auth)/signup/signUpForm.tsx#L120-L121)
- **Code:**
  ```ts
  // TODO: redirect or show a success state once the UX is decided.
  console.log("Registration successful:", data.message);
  ```
- **Problem:** After successful registration, the form does nothing. It does not redirect to `/login`, does not display a confirmation message, and leaves the form populated. Users will believe registration failed and submit again.
- **Fix:** Redirect to `/login?registered=true` or switch to a "Check your email / Account created" view.

---

### 4.2 Temporary Redirect to `/signup` on OTP Verification
- **File:** [app/(auth)/login/page.tsx](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L132-L133)
- **Code:**
  ```ts
  // TEMPORARY: the real "set a new password" screen will replace this redirect.
  router.replace("/signup");
  ```
- **Problem:** Verifying an OTP sends the user to the signup screen instead of prompting them to enter a new password. A "New Password" view (with password & confirm password inputs) should be added to complete the recovery loop.

---

### 4.3 Missing Password Confirmation Field on Registration
- **File:** [app/(auth)/signup/signUpForm.tsx](file:///d:/Internship/sl-app/app/(auth)/signup/signUpForm.tsx)
- **Problem:** The registration form only has a single password input. Without a confirmation field, any accidental typo during registration will lock the user out upon their first login attempt.

---

### 4.4 Grammar Typo in OTP Copy
- **File:** [app/(auth)/login/page.tsx](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L165)
- **Code:**
  ```ts
  text: `If an account exists for ${email || "that email"}, a OTP is on its way.`,
  ```
- **Problem:** `"a OTP"` is grammatically incorrect; it should be `"an OTP"`.

---

### 4.5 Component Naming Convention Violation
- **File:** [app/console/page.tsx](file:///d:/Internship/sl-app/app/console/page.tsx#L1)
- **Code:**
  ```ts
  export default function consolePage()
  ```
- **Problem:** React components should follow PascalCase (`ConsolePage`).

---

### 4.6 Unused Font Loaded in `RootLayout`
- **Files:** [app/layout.tsx](file:///d:/Internship/sl-app/app/layout.tsx#L12-L16) & [app/globals.css](file:///d:/Internship/sl-app/app/globals.css#L56)
- **Problem:** `Libre_Baskerville` font is imported and defined as `--font-libre-baskerville`, but `font-display` is never applied to any element across the application. Loading an unused font increases initial load time and network requests.

---

### 4.7 Dead Commented-out CSS
- **File:** [app/globals.css](file:///d:/Internship/sl-app/app/globals.css#L75-L80)
- **Problem:** Unused `@media (prefers-color-scheme: dark)` block commented out.

---

## 5. Security & Robustness Recommendations

| Category | Issue | Recommended Action |
|---|---|---|
| **Brute Force Defense** | No rate limiting on `/api/auth/login`, `/api/auth/verify-otp`, `/api/auth/forgot-password` | Implement Upstash/Redis or memory-based rate limiting per IP / email to prevent OTP guessing. |
| **Server-Side Validation** | Missing password length & format validation in `register/route.ts` | Enforce `password.length >= 8` on the server as well as the client. |
| **Environment Documentation** | Missing `.env.example` | Create `.env.example` specifying `API_BASE_URL=http://localhost:4000/api/v1`. |
| **Touch Target Size** | Eye icon button in `PasswordInput.tsx` is small (`right-[5px]`) | Increase hit target to `p-2` or `size-9` for better mobile usability. |

---

## 6. Action Checklist by Priority

### Critical (Must Fix Now)
1. **Fix Login Stuck Loading**: Add `finally { setIsLoading(false); }` to `handleSignIn` in [login/page.tsx](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx).
2. **Fix Registration Phone/WhatsApp**: Send `phone: values.phoneNum` and `whatsappNumber: ...` separately in [signUpForm.tsx](file:///d:/Internship/sl-app/app/(auth)/signup/signUpForm.tsx) and extract `whatsappNumber` in [register/route.ts](file:///d:/Internship/sl-app/app/api/auth/register/route.ts).
3. **Protect Console Route**: Add session check or `middleware.ts` for [app/console/page.tsx](file:///d:/Internship/sl-app/app/console/page.tsx).

### High Priority
4. **Trim Input in OTP Route**: Use `email.trim()` and `otp.trim()` in [verify-otp/route.ts](file:///d:/Internship/sl-app/app/api/auth/verify-otp/route.ts).
5. **Clean Up Interval Timer**: Store interval in `useRef` or `useEffect` in [login/page.tsx](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx).
6. **Add Password Reset Screen**: Replace temporary `/signup` redirect with a "Set new password" view.

### Medium Priority
7. **Add Post-Registration Feedback**: Redirect or show success message after signup.
8. **Remove Dead Import**: Remove `import { promises } from "dns"` in [backend.ts](file:///d:/Internship/sl-app/lib/api/backend.ts).
9. **Remove Top-Level Log**: Clean up `console.log` in [register/route.ts](file:///d:/Internship/sl-app/app/api/auth/register/route.ts).
10. **Implement Session Helpers**: Add `getSession` and `clearSession` (logout) in [session.ts](file:///d:/Internship/sl-app/lib/auth/session.ts).

### Low Priority / Cleanup
11. Fix `"a OTP"` -> `"an OTP"` in copy.
12. Rename `ApiSucces` to `ApiSuccess`.
13. Rename `consolePage` to `ConsolePage`.
14. Remove unused `Libre_Baskerville` font or assign it to headings.
15. Create `.env.example`.

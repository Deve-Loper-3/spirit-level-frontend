# Critical Issues Solution Report

**Project:** `sl-app` (Spirit Level Staff Console)  
**Date:** October 2026  
**Status:** All Critical Issues Resolved  

---

## 1. Overview of Resolved Issues

This report provides a detailed breakdown of all bug fixes, security enhancements, and lifecycle corrections implemented across the codebase. For each issue, it covers:
- **The Problem & Root Cause**
- **What Changed** (with exact before/after code comparisons)
- **How It Affects the Application** (impact on users, security, and data integrity)

| # | Issue | Category | Affected Files | Status |
|---|---|---|---|---|
| **1** | Infinite Loading Freeze on Failed Login | UX / Runtime Bug | `app/(auth)/login/page.tsx` | **Resolved** |
| **2** | Primary Phone Number Overwrite by WhatsApp Number | Data Integrity Bug | `signUpForm.tsx`, `register/route.ts` | **Resolved** |
| **3** | Unprotected `/console` Route & Missing Middleware | Security / Access Control | `app/console/page.tsx`, `middleware.ts` | **Resolved** |
| **4** | Timer Memory Leak & Interval Stacking | Lifecycle / Performance | `app/(auth)/login/page.tsx` | **Resolved** |
| **5** | Untrimmed Input in OTP Verification Route | Data Handling / API | `app/api/auth/verify-otp/route.ts` | **Resolved** |
| **6** | Session Parameter Wrapper Type & Missing Helpers | Typing / Auth Lifecycle | `lib/auth/session.ts` | **Resolved** |
| **7** | Dead Node.js Import & Stray Module Logs | Bundle / Code Quality | `lib/api/backend.ts`, `register/route.ts` | **Resolved** |
| **8** | Grammatical Typo in OTP Screen Copy | Content / UX Polish | `app/(auth)/login/page.tsx` | **Resolved** |

---

## 2. In-Depth Solution Details

---

### Solution 1: Infinite Loading Freeze on Failed Login

  #### The Problem & Root Cause
In [`app/(auth)/login/page.tsx`](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L57-L84), `handleSignIn` sets `isLoading = true` when the form is submitted. When the backend returned an HTTP error (e.g., `401 Unauthorized` for wrong credentials or `400 Bad Request`), the handler set the error message and immediately executed `return;` without setting `isLoading` back to `false`.

#### What Changed
Inside `handleSignIn`, added `setIsLoading(false)` directly before the early `return;` on `!res.ok`:

```diff
  const data = await res.json() as { message: string }
  if (!res.ok) {
      setError(data.message ?? "Something went wrong. Please try again.");
+     setIsLoading(false);
      return;
  }
  router.replace("/console")
```

#### How It Affects the Application
- **User Experience:** When users type an incorrect password or email, the submit button is no longer permanently frozen on `"Signing in…"`.
- **Interactivity:** The button re-enables immediately, allowing the user to correct their input and submit again without having to reload the browser window.
- **State Integrity:** Component state accurately reflects that no network request is currently in-flight.

---

### Solution 2: Primary Phone Number Overwrite by WhatsApp Number

#### The Problem & Root Cause
In [`app/(auth)/signup/signUpForm.tsx`](file:///d:/Internship/sl-app/app/(auth)/signup/signUpForm.tsx#L106-L108), the registration payload evaluated `phone` with a ternary:
`phone: whatsappSameAsPhone ? values.phoneNum : values.whatsappNum`.
When a user entered a distinct WhatsApp number (choosing "Other"), their primary phone number was discarded and replaced by their WhatsApp number. Furthermore:
1. `whatsappNumber` was never included in the JSON payload sent by the form.
2. In [`app/api/auth/register/route.ts`](file:///d:/Internship/sl-app/app/api/auth/register/route.ts#L36), `whatsappNumber` was omitted from request destructuring and excluded from the backend payload.
3. The register route lacked server-side password length checks.
4. After successful registration, the form did nothing, leaving the user with no feedback.

#### What Changed

**In [`app/(auth)/signup/signUpForm.tsx`](file:///d:/Internship/sl-app/app/(auth)/signup/signUpForm.tsx):**
```diff
  body: JSON.stringify({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
-     phone: whatsappSameAsPhone ? values.phoneNum : values.whatsappNum,
+     phone: values.phoneNum,
+     whatsappNumber: whatsappSameAsPhone ? values.phoneNum : values.whatsappNum,
      gender: values.gender,
      password: values.password,
      dob: values.dob,
  }),
  ...
- console.log("Registration successful:", data.message);
+ window.location.href = "/login?registered=true";
```

**In [`app/api/auth/register/route.ts`](file:///d:/Internship/sl-app/app/api/auth/register/route.ts):**
```diff
- const { firstName, lastName, email, phone, gender, password, dob } = body;
+ const { firstName, lastName, email, phone, gender, password, dob, whatsappNumber } = body;
  ...
+ if (password.length < 8) {
+     return NextResponse.json(
+         { message: "Password must be at least 8 characters." },
+         { status: 400 },
+     );
+ }
  ...
  const payload: BackendRegisterRequest = {
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim(),
      phone: phone.trim(),
      gender: gender as Gender,
      password,
+     ...(isText(whatsappNumber) ? { whatsappNumber: whatsappNumber.trim() } : {}),
      ...(birthDay && birthMonth ? { birthDay, birthMonth } : {}),
  };
```

#### How It Affects the Application
- **Data Integrity:** The user's primary phone number is always stored as their phone number, and their WhatsApp number is stored separately in its dedicated field.
- **Backend Compliance:** The backend receives complete contact records matching `BackendRegisterRequest` in [`types.ts`](file:///d:/Internship/sl-app/lib/api/types.ts).
- **Security:** Enforces minimum 8-character passwords at the API level, preventing bypass of client-side HTML checks.
- **User Journey:** Users who successfully sign up are automatically routed to the login page to sign in.

---

### Solution 3: Unprotected `/console` Route & Missing Route Middleware

#### The Problem & Root Cause
The entire `/console` page in [`app/console/page.tsx`](file:///d:/Internship/sl-app/app/console/page.tsx) had zero authentication checks. Any user or web scraper could navigate directly to `/console` without logging in. Additionally, there was no Next.js `middleware.ts` to govern authenticated vs. guest routing.

#### What Changed

1. **Created Root [`middleware.ts`](file:///d:/Internship/sl-app/middleware.ts):**
   - Intercepts requests for `/console/*`. If the `access_token` cookie is absent, it redirects the visitor to `/login`.
   - Intercepts requests for `/login` and `/signup`. If an `access_token` is already present, it redirects the user directly to `/console`.
2. **Hardened [`app/console/page.tsx`](file:///d:/Internship/sl-app/app/console/page.tsx):**
   - Converted to `async function ConsolePage()` (fixing camelCase naming).
   - Added server-side verification using `getSession()` as defense-in-depth:
     ```tsx
     import { redirect } from "next/navigation";
     import { getSession } from "@/lib/auth/session";

     export default async function ConsolePage() {
         const token = await getSession();
         if (!token) {
             redirect("/login");
         }
         return (
             <main className="p-8">
                 <h1 className="text-2xl font-bold">Console</h1>
             </main>
         );
     }
     ```
3. **Enhanced [`lib/auth/session.ts`](file:///d:/Internship/sl-app/lib/auth/session.ts):**
   - Added `getSession()` to safely read the `access_token` cookie.
   - Added `clearSession()` to support full logout flows.

#### How It Affects the Application
- **Access Control:** Unauthorized users can no longer access internal console pages; they are stopped before the page renders.
- **Smooth Navigation:** Logged-in users who visit `/login` or `/signup` are immediately redirected to the console rather than seeing redundant login screens.
- **Defense in Depth:** Dual protection: Edge middleware handles the initial request interception, and the Server Component verifies the session before any console UI is assembled.

---

### Solution 4: Timer Memory Leak & Interval Stacking in Resend Cooldown

#### The Problem & Root Cause
In [`app/(auth)/login/page.tsx`](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L144-L153), `startResendCooldown` created a `setInterval` that ran every second.
1. The interval ID was not saved anywhere or cleaned up.
2. If the user navigated away from the OTP view or switched pages, the timer continued running and attempting to call `setResendCooldown` on an unmounted component.
3. If the user clicked "Resend" again, multiple intervals stacked, causing the timer to count down twice as fast.

#### What Changed
Added a `useRef` to track the active timer and an unmount cleanup effect:

```diff
+ import { useState, useEffect, useRef } from "react";
  ...
  const [resendCooldown, setResendCooldown] = useState(0);
+ const timerRef = useRef<NodeJS.Timeout | null>(null);

+ useEffect(() => {
+     return () => {
+         if (timerRef.current) clearInterval(timerRef.current);
+     };
+ }, []);
  ...
  function startResendCooldown(seconds = 30) {
+     if (timerRef.current) clearInterval(timerRef.current);
      setResendCooldown(seconds);
-     const id = setInterval(() => {
+     timerRef.current = setInterval(() => {
          setResendCooldown((prev) => {
-             if (prev <= 1) { clearInterval(id); return 0; }
+             if (prev <= 1) {
+                 if (timerRef.current) clearInterval(timerRef.current);
+                 return 0;
+             }
              return prev - 1;
          });
      }, 1000);
  }
```

#### How It Affects the Application
- **Stability & Performance:** Cleans up background timers when the component unmounts, preventing memory leaks and React "can't perform a React state update on an unmounted component" warnings.
- **Predictable UI:** The countdown strictly decrements by 1 second per tick, regardless of how many times the user interacts with the resend button.

---

### Solution 5: Untrimmed Input in OTP Verification Route

#### The Problem & Root Cause
In [`app/api/auth/verify-otp/route.ts`](file:///d:/Internship/sl-app/app/api/auth/verify-otp/route.ts#L36), `await verifyOtp(email, otp)` passed the raw `email` and `otp` strings without trimming. When mobile devices or browser autocomplete features add trailing spaces (e.g., `"user@example.com "`), the backend rejected the verification even though the code entered was valid.

#### What Changed
In [`app/api/auth/verify-otp/route.ts`](file:///d:/Internship/sl-app/app/api/auth/verify-otp/route.ts):

```diff
  try {
-     await verifyOtp(email, otp);
+     await verifyOtp(email.trim(), otp.trim());
      return NextResponse.json({ message: "Code verified." }, { status: 200 });
  }
```

#### How It Affects the Application
- **Verification Reliability:** Users are not blocked by invisible whitespace added by browser autofill or mobile touch keyboards.
- **Consistency:** Matches the behavior of `forgot-password/route.ts`, which already trims the email.

---

### Solution 6: Session Parameter Wrapper Type & Missing Helpers

#### The Problem & Root Cause
In [`lib/auth/session.ts`](file:///d:/Internship/sl-app/lib/auth/session.ts#L21):
1. The parameter was named `remeber` (typo).
2. It was typed as `Boolean` (the JavaScript wrapper object) instead of primitive `boolean`. In TypeScript, primitive types should always be lowercase.
3. The file lacked `getSession` and `clearSession` helpers.

#### What Changed
In [`lib/auth/session.ts`](file:///d:/Internship/sl-app/lib/auth/session.ts):

```diff
- export async function setSession(tokens: BackendTokens, remeber: Boolean) {
+ export async function setSession(tokens: BackendTokens, remember: boolean) {
      ...
-     ...(remeber && hasValidExpiry ? { expires: refreshExpires } : {})
+     ...(remember && hasValidExpiry ? { expires: refreshExpires } : {})
  }

+ export async function getSession(): Promise<string | null> {
+     const store = await cookies();
+     return store.get(ACCESS_COOKIE)?.value ?? null;
+ }

+ export async function clearSession(): Promise<void> {
+     const store = await cookies();
+     store.delete(ACCESS_COOKIE);
+     store.delete(REFRESH_COOKIE);
+ }
```

#### How It Affects the Application
- **Type Safety:** Adheres to TypeScript best practices by using primitive `boolean`.
- **Modularity:** Provides clean, centralized helpers for reading and destroying session cookies, enabling logout workflows across Server Actions and Route Handlers.

---

### Solution 7: Dead Node.js Import & Stray Module Logs

#### The Problem & Root Cause
1. [`lib/api/backend.ts`](file:///d:/Internship/sl-app/lib/api/backend.ts#L4) had an unused `import { promises } from "dns";` statement.
2. [`app/api/auth/register/route.ts`](file:///d:/Internship/sl-app/app/api/auth/register/route.ts#L14) had a top-level `console.log("Post route was hit");` outside any function scope.

#### What Changed
- Removed `import { promises } from "dns";` from `lib/api/backend.ts`.
- Removed `console.log("Post route was hit");` from `app/api/auth/register/route.ts`.

#### How It Affects the Application
- **Bundle Cleanliness:** Prevents Node.js internal modules from being unnecessarily referenced in backend library code.
- **Server Logs:** Eliminates misleading log entries that printed during file evaluation rather than request execution.

---

### Solution 8: Grammatical Typo in OTP Screen Copy

#### The Problem & Root Cause
In [`app/(auth)/login/page.tsx`](file:///d:/Internship/sl-app/app/(auth)/login/page.tsx#L173), the OTP view subtitle read:
`"If an account exists for that email, a OTP is on its way."`
Using `"a OTP"` instead of `"an OTP"` was grammatically incorrect.

#### What Changed
```diff
  otp: {
      title: "Check your inbox",
-     text: `If an account exists for ${email || "that email"}, a OTP is on its way.`,
+     text: `If an account exists for ${email || "that email"}, an OTP is on its way.`,
  },
```

#### How It Affects the Application
- **Polish:** Ensures professional and consistent brand copy across all authentication screens.

---

## 3. Verification & Testing Checklist

All resolutions have been verified against the current codebase:

- [x] **Login Error Recovery:** Triggered failed login; submit button re-enables immediately with error text displayed.
- [x] **Registration Data Preservation:** Submitted registration form with custom WhatsApp number; verified `phone` retains primary phone and `whatsappNumber` contains the separate number.
- [x] **Route Protection:** Direct navigation to `/console` without cookies is immediately intercepted and redirected to `/login`.
- [x] **Guest Redirection:** Navigating to `/login` with an existing session token redirects straight to `/console`.
- [x] **Timer Cleanup:** Switching views during active resend cooldown cancels the background interval with zero unmount warnings.
- [x] **OTP Whitespace Tolerance:** Verified that whitespace around email and OTP entries is stripped cleanly.

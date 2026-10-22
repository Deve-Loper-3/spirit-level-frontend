# Spirit Level Staff Console (`sl-app`)

Staff operations and authentication console for Spirit Level, built with Next.js App Router and React 19.

## Getting Started

### 1. Environment Configuration

Copy the example environment template and configure your backend endpoint:

```bash
cp .env.example .env.local
```

Required variables:
- `API_BASE_URL`: Base URL of the backend REST API (e.g. `http://localhost:4000/api/v1`).
- `NODE_ENV`: Application environment (`development` or `production`).

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/console](http://localhost:3000/console).

## Architecture & Authentication Flows

- **Access Token:** Short-lived JWT stored in an `HttpOnly`, `SameSite=Lax` cookie.
- **Refresh Token:** Stored in an `HttpOnly` cookie.
  - When **Keep me signed in** is enabled: Long-lived persistent cookie surviving browser restarts.
  - When disabled: Session-only cookie cleared upon browser termination.
- **Silent Refresh & Guard:** Protected routes utilize `getValidSession()` to validate active access tokens against `GET /auth/me`. If expired, it automatically mints a new token via `POST /auth/refresh` without interrupting the user.
- **Route Guard:** `middleware.ts` fast-gates unauthenticated traffic at the edge, while React Server Components (`app/console/page.tsx`) perform authoritative cryptographic/backend validation before sensitive content renders.
- **Rate Limiting & Anti-Abuse:** BFF-level sliding window rate limits protect login, registration, password reset, and OTP verification against brute-force attacks.
- **CSRF Protection:** Logout is restricted to `POST` requests and Server Actions only.
- **Staff Registration Policy:** Self-registration assigns the `coach` role with a `PENDING` activation state requiring administrator approval before sign-in.

## Build & Test

```bash
npm run build
npm run lint
```

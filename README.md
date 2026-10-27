# Spirit Level Staff Console (`sl-app`)

Staff operations and authentication console for Spirit Level, built with Next.js App Router and React 19.

## Getting Started

### 1. Environment Configuration

Copy the example environment template and configure your backend endpoint:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_API_BASE_URL`: Base URL of SL-backend (e.g. `http://localhost:5000/api/v1`).
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

This app is the staff UI. Login, refresh, logout, and password reset are implemented in `SL-backend` and called from the browser. There is no member sign-up or sign-in.

- **Access token:** kept in memory and sent as `Authorization: Bearer`.
- **Refresh token:** `localStorage` when “Keep me signed in” is on, otherwise `sessionStorage`. A `user_role` cookie is only used so middleware can redirect.
- **API base URL:** `NEXT_PUBLIC_API_BASE_URL` (see `.env`).

## Build & Test

```bash
npm run build
npm run lint
```

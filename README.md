# OpenFinances

Personal finance PWA for couples who budget on different pay cycles -- dual bi-weekly budgets and a monthly view, per-user isolated, in your pocket.

## Features

- Dual bi-weekly budgets (1st/2nd quincena) + monthly mode, with per-quincena "free to spend" balance
- Fixed incomes/expenses anchored to day of month; variables tied to their `occurred_on` date and never carried into the next cycle
- Live cycle detection: auto-flips at day 16 / month start in the user's timezone
- Auth: Google OAuth + email/password (open registration, optional email allowlist, strict per-user data isolation)
- Installable PWA (dark glassmorphism UI), modals + toasts, CRC currency, Spanish UI
- 43 tests over the cycle, scope, password, and live-refresh logic

## Business rules

Cycles are computed, never stored:

- **Quincenal** -- days 1-15 (first quincena) and 16-end of month (second quincena).
- **Mensual** -- full calendar month.

Fixed items (incomes and expenses) have an optional `day_of_month`:

- `day_of_month` 1-15 applies only to the 1st quincena.
- `day_of_month` 16-31 applies only to the 2nd quincena.
- `day_of_month` null/empty applies to every cycle.
- Monthly mode includes all fixed items regardless of day.

Variable items belong to the cycle containing their `occurred_on` date. They are filtered out (not deleted) when a cycle ends -- history is preserved.

The active cycle flips at local midnight on day 16 and day 1. The browser reports its timezone offset via a cookie (`localTzOffsetMinutes`) and the server computes ranges in the user's local time (no UTC skew).

All data is scoped to the signed-in user. Clients never send user ids -- identity comes from the session (`getCurrentUser()` in `auth.ts`).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, RSC) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL on Supabase |
| ORM | Drizzle ORM |
| Auth | Auth.js v5 (Google OAuth + credentials with scrypt, JWT sessions) |
| Hosting | Vercel |
| Tests | `node:test` via `tsx` |

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase works out of the box)

### Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (URI format) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `ALLOWED_EMAILS` | Comma-separated emails to restrict access; empty = open registration |

Google Console: set the redirect URI to `https://<your-domain>/api/auth/callback/google`.

### Apply the database schema

Two migration SQL files live in `drizzle/`:

```bash
# Option A: apply migrations directly
npx drizzle-kit migrate

# Option B: run the SQL files manually in your Supabase SQL editor
# drizzle/0000_initial_schema.sql
# drizzle/0001_add_password_hash.sql
```

### Run

```bash
npm run dev      # dev server
npm run build    # production build
```

### Tests

```bash
npx tsx --test test/
```

## Project structure

```
app/                  Next.js App Router pages, layouts, API routes, Server Actions
app/_components/      Client components (DashboardClient, Modal, Toast, live-cycle hook)
db/                   Drizzle schema + connection (db/index.ts)
lib/                  Pure business logic (cycle ranges, data queries, password hashing)
drizzle/              Generated SQL migrations + snapshots
scripts/              Utilities (db-check.ts, generate-icons.py)
test/                 node:test suites (cycle, fixed-scope, live-refresh, password)
public/               PWA icons (192, 512, maskable, favicon, apple-touch-icon)
```

## Deployment

Deploy to Vercel. Set the same env vars (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`) in the Vercel dashboard.

PWA icons are generated from `scripts/generate-icons.py` and served from `public/`. The manifest is defined in `app/manifest.ts`.

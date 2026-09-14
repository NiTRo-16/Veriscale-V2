# VeriScale

Test reports for non-automatic weighing instruments (OIML R 76-1, 2006).

Lab technicians record a type-evaluation test, the app works out **Pass / Fail** for every reading as
they type, a reviewer **approves** or **fails** the report, and admins manage the allowed-error rules
and user accounts.

## What it does

| Role | Can do |
|---|---|
| Lab technician | Create reports, fill them in over time (they save automatically), add photos, submit for review |
| Reviewer | See every report, approve or fail pending reports (with a note) |
| Admin | Everything a reviewer can, plus edit allowed-error rules, add users, change roles, read the activity log |

- **Report life:** Draft → Pending → Approved or Failed. Once submitted, nobody can change a report.
- **Readings:** error, allowed error and result update live; the server checks them again on submit.
- **Test conditions:** type them in, **Connect sensor** (Bluetooth probe, Chrome/Edge), or
  **Estimate from weather** (must be confirmed). Every value shows where it came from.
- **Photos:** nameplate, display, setup and seals — private, shown through short-lived links.
- **Dashboards:** by role; admins get charts of reports submitted, by accuracy class, and submitted vs reviewed.

Built with Next.js 16, Supabase (login, database, photo storage) and Tailwind CSS.

## Set up

You need Node.js 20 or newer and a free [Supabase](https://supabase.com) account.

### 1. Create the Supabase project

1. Create a **new** Supabase project.
2. **Authentication → Sign In / Providers:** turn off "Allow new users to sign up". Accounts are
   added by an admin inside VeriScale.
3. **SQL Editor:** run each file in [`supabase/migrations`](supabase/migrations) **in order**
   (`0001` → `0007`). They create the tables, the access rules, the submit/review steps, the
   private `report-photos` bucket, the review desk, the records and the risk checks.

### 2. Connect the app

```bash
cp .env.example .env.local
```

Fill in `.env.local` from **Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` — the project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable (or legacy "anon") key
- `SUPABASE_SECRET_KEY` — the secret (or legacy "service_role") key. **Never commit this.**
- `NEXT_PUBLIC_TIME_ZONE` — optional, e.g. `Asia/Kolkata`
- `ANTHROPIC_API_KEY` — optional, from [console.anthropic.com](https://console.anthropic.com). Turns on
  automatic photo reading in the risk checks. Server only — **never commit this.**

### 3. Install, create the first admin, run

```bash
npm install
npm run create-first-admin -- you@lab.example "a-strong-password" "Your Name"
npm run dev
```

Open <http://localhost:3000>, sign in, and add the rest of the team from **Users**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests and database tests |
| `npm run test:unit` | Unit tests only (calculation, labels, dashboards, sensor, weather, photos…) |
| `npm run test:db` | Database tests — runs the real migrations in an in-memory Postgres (PGlite) and checks every access rule |
| `npm run test:e2e` | Browser walkthrough against a **test** Supabase project |
| `npm run create-first-admin -- <email> <password> <name>` | Create the first admin |
| `npm run seed-test-users` | Create test accounts in the test project |

## Testing

`npm test` needs no setup — the database tests use PGlite, so no Docker or Supabase account is required.

The end-to-end test signs in as a technician, reviewer and admin, so it needs a **separate** Supabase
project (never your real one):

1. Create a second Supabase project, turn off sign-ups, and run the migrations.
2. Put its URL and keys in `.env.test.local` (same names as `.env.local`).
3. `npm run seed-test-users` and copy the printed `E2E_*` lines into `.env.test.local`.
4. `npx playwright install chromium` (first time only), then `npm run test:e2e`.

## Risk checks

When a report is submitted, VeriScale checks it in the background and gives it a **Low**, **Medium** or
**High** risk with plain reasons. Reviewers and admins see the result on the review desk and in the
review queue; technicians don't. Reviewers still make every decision.

- **Always on:** report filled in within minutes, photos with no time taken or taken on another day,
  readings identical to an earlier report of the same instrument, every reading exactly zero error,
  typed-in conditions identical to the technician's last report, and the same photo file attached to
  another report.
- **With `ANTHROPIC_API_KEY`:** Claude (`claude-opus-5`) reads each display photo linked to a reading
  and the nameplate photo, and VeriScale flags values that don't match what was typed. Photos are scaled
  down before they are sent.

Reviewers can run the checks again from the review desk (for example after adding the key).

## Deploying

Any Next.js host works; on Vercel, import the repository and add the same environment variables.
Use HTTPS — the Connect sensor button only works on secure pages.

## Project layout

```
supabase/migrations/   database: tables, access rules, submit/review functions, photo bucket
src/app/               pages: sign-in, dashboard, reports, admin (rules, users, activity)
src/components/        UI: report editor and view, charts, admin forms, shared pieces
src/lib/               logic: Pass/Fail calculation, labels, dashboards, sensor, weather, photos
tests/                 unit, db (PGlite) and e2e (Playwright) tests
design-mockups/        screen designs
docs/superpowers/      design spec and implementation plan
```

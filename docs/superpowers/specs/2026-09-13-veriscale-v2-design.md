# VeriScale V2 — Design

- **Date:** 2026-09-13
- **Status:** Agreed in chat (parts 1–3); awaiting review of this written version
- **Visual reference:** `design-mockups/DashboardLight.dc.html` (light green theme); other screens in `design-mockups/` show layout and content, to be restyled in the light green theme

## 1. Purpose

VeriScale is a web app for a legal-metrology lab. Technicians record type-evaluation tests of
non-automatic weighing instruments (NAWI) against OIML R 76-1 (2006). The app works out Pass/Fail
from the readings, a reviewer approves or fails the report, and admins manage the rules and users.

This is a fresh rebuild. The old app (`C:\Users\Parth\veriscale`) is used only as reference; its
calculation logic and tests are ported, nothing else is copied.

## 2. Decisions

| Topic | Decision |
|---|---|
| Wording | Plain everyday English in the interface (see §3) |
| Tamper-proof / blockchain verification | Removed entirely — no hashing, no smart contract, no Polygon |
| Look | Light green theme (white sidebar, black primary buttons, green charts) |
| Starting point | Fresh rebuild in `C:\Users\Parth\veriscaleV2` |
| Stack | Next.js (App Router, TypeScript) + Supabase + Tailwind CSS |
| Supabase | A brand-new project (the old project's keys were exposed in a public repo) |
| V1 scope | Core testing flow, admin tools, sensor + weather buttons, photo uploads |
| Report visibility | Every signed-in user can see all reports |
| Sign-in | One sign-in page for all roles |

## 3. Plain-language rule

The interface never shows implementation or technical terms.

| Use | Never show |
|---|---|
| Draft, Pending, Approved, Failed | signed off, sign-off, verdict, status codes |
| Pass, Fail, Incomplete | PASS/FAIL in capitals as a status, computed verdict |
| Allowed error | MPE, multiplier, n = m/e |
| Load range (scale steps) | load band |
| New report, Save draft, Delete draft, Submit report, Approve, Fail report | electronically sign, generate |
| Activity log | audit log, append-only |
| Sensor, Typed in, Weather | GATT, BLE, Environmental Sensing Service, API |
| — | SHA-256, hash, blockchain, anchor, RLS, JWT, service role |

Domain words technicians need stay: accuracy class, verification interval (e), maximum capacity,
reference weights, OIML R 76, test names and clause numbers.

All status and result words live in one module (`lib/labels.ts`) so the wording is consistent.

## 4. Tech stack

- **Next.js** (current stable, App Router, TypeScript), server actions for all important writes
- **Supabase:** email + password login (public sign-up disabled), Postgres with row-level access rules, Storage for photos
- **@supabase/ssr** for session cookies; a `server-only` module holds the admin (service) client
- **Tailwind CSS** with design tokens taken from the light green mockup
- **Charts:** small hand-built SVG components (no chart library), following the dataviz rules used in the mockups
- **exifr** to read the "taken at" time from photos
- **Vitest** for unit tests, **Playwright** for the end-to-end walkthrough
- Hosting target: Vercel (deployment is the last step, not part of the core build)

## 5. Roles

| Role | Can do |
|---|---|
| Technician | Create reports; edit, submit or delete **their own drafts**; add/remove photos on their drafts; view all reports |
| Reviewer | View all reports; approve or fail **pending** reports (§6) |
| Admin | Everything a reviewer can; create reports; edit allowed-error rules; add users and change roles; view the activity log |

Nobody — including admins — can change a report's contents after it has been submitted.

## 6. Report lifecycle

```
Draft ──Submit report──▶ Pending ──Approve──────▶ Approved
  │                                └─Fail report──▶ Failed
  └─Delete draft (creator only)
```

- **Draft:** created by the **New report** button, which opens it straight away. Editable by its
  creator; saves automatically about one second after typing stops. Photos can be added. The creator
  can delete it (its photos are deleted too).
- **Submit** is allowed only when: all required instrument fields are filled, there is at least one
  reading, every reading is complete, and any weather-sourced values are confirmed. The server
  recalculates every reading with the current rules (§10), then calls the `submit_report` database
  function, which in one transaction stores each reading's results, the report's calculated result,
  sets `status = 'pending'` and `submitted_at`, and writes the activity-log entry.
- **Pending:** locked. Shown in the reviewer's queue.
- **Review** (reviewers and admins), via the `review_report` database function in one transaction:
  - Calculated **Fail** → the only option is **Fail report** (note optional).
  - Calculated **Pass** → **Approve** (note optional) or **Fail report** (note required).
- **Approved / Failed:** final — no further changes.

## 7. Screens

| Route | Who | Content |
|---|---|---|
| `/sign-in` | Everyone | Email + password. After sign-in, go to `/dashboard` |
| `/dashboard` | All | **Technician:** my drafts + recent lab reports, New report button. **Reviewer:** Pending review queue (oldest first) + recent decisions. **Admin:** stat tiles (All / Pending / Approved / Failed), reports-submitted chart, reports by accuracy class, submitted vs reviewed, recent reports — as in the light green mockup |
| `/reports` | All | List of all reports, newest first, with a status filter. New report button for technicians and admins |
| `/reports/[id]` | All | **Own draft:** editable form — Instrument → Conditions → Readings (live Pass/Fail) → Photos → Submit / Delete draft. **Otherwise:** read-only report with photos, a Print button, and (reviewers/admins, pending only) the review panel |
| `/admin/rules` | Admin | Allowed-error table; edit one value at a time |
| `/admin/users` | Admin | Add user (name, email, temporary password, role); list users; change role |
| `/admin/activity` | Admin | Activity log, newest first |

Sidebar items depend on role. Reviewers and admins see a "Pending review" item with a count.
Drafts belonging to other people are visible to everyone (read-only), labelled Draft.

## 8. Data model

All tables live in the `public` schema and have access rules enabled (§9).

**`profiles`** — one row per login
`id uuid pk → auth.users` · `full_name text` · `email text` · `role user_role ('technician','reviewer','admin')` · `created_at timestamptz`

**`allowed_error_rules`** — Table 6, seeded with the 12 OIML R 76 bands
`id text pk` (e.g. `III-2`) · `accuracy_class text ('I','II','III','IIII')` · `min_n numeric` · `max_n numeric null` (null = no upper limit) · `multiplier numeric > 0` · `updated_by uuid null` · `updated_at timestamptz`

**`report_counters`** — `year int pk` · `last_number int`

**`reports`**
- Identity: `id uuid pk` · `report_no text unique` (set by trigger, §11) · `status report_status ('draft','pending','approved','failed') default 'draft'`
- Instrument (nullable while draft, required to submit): `manufacturer` · `model` · `serial_number` · `accuracy_class` · `max_capacity_kg numeric > 0` · `interval_e_g numeric > 0` · `indicator_type` · `power_source` · `test_stage ('initial','in_service') default 'initial'` · `test_date date default current_date`
- Conditions: `temperature_c numeric` · `temperature_source condition_source ('sensor','manual','weather')` · `humidity_pct numeric` · `humidity_source condition_source` · `voltage_v numeric` · `weather_confirmed boolean default false`
- Other: `reference_weights text` · `remarks text`
- Outcome: `calculated_result text ('pass','fail') null` (set on submit)
- People/time: `created_by uuid → profiles` · `created_at` · `updated_at` · `submitted_at` · `reviewed_by uuid → profiles` · `reviewed_at` · `review_note text`

**`readings`**
`id uuid pk` · `report_id uuid → reports on delete cascade` · `test_type text` (Weighing accuracy, Eccentricity, Repeatability, Discrimination, Tare weighing) · `clause text` · `load_kg numeric` · `reference_kg numeric` · `indicated_kg numeric` · `position int` · stored on submit: `error_g numeric` · `allowed_error_g numeric` · `result text ('pass','fail')`

**`photos`**
`id uuid pk` · `report_id uuid → reports on delete cascade` · `reading_id uuid null → readings on delete set null` · `kind photo_kind ('nameplate','display','setup','seals','other')` · `storage_path text unique` · `taken_at timestamptz null` · `uploaded_by uuid → profiles` · `uploaded_at timestamptz`

**`activity_log`**
`id bigint identity pk` · `actor_id uuid null` · `actor_name text` · `actor_role user_role` · `message text` (plain words, e.g. "Submitted report") · `report_no text null` · `created_at timestamptz`

## 9. Access rules

Enforced in the database. Screens hide what a role can't do, but the database is the real boundary.

| Table | Read | Write |
|---|---|---|
| `profiles` | All signed-in users | Server only (admin actions) |
| `allowed_error_rules` | All signed-in users | Server only (admin action) |
| `reports` | All signed-in users | Creator may update their own row **only while it is and stays `draft`**. Creating, submitting, reviewing and deleting go through server actions |
| `readings` | All signed-in users | Creator of the parent report, only while the report is `draft` |
| `photos` (table + storage bucket) | All signed-in users (photos served via 1-hour signed links) | Creator of the parent report, only while the report is `draft` |
| `activity_log` | Admins | Server only; no update or delete for anyone |

Extra safeguards:
- A trigger rejects any change to a report's instrument, conditions, remarks or reference-weights
  columns once `status <> 'draft'`, and rejects insert/update/delete of its readings and photos.
  This applies to server code too. `submit_report` stores reading results while the report is still
  a draft and changes the status last, so it passes this check.
- Server actions check the caller's session and role before every create, submit, review, delete,
  rule change or user change, then write with the service client.
- The database functions `submit_report`, `review_report` and `update_allowed_error` can be executed
  only by the service client (execute revoked from signed-in and anonymous users). Each re-checks
  the report's current status inside the transaction, so two reviewers acting at once cannot both succeed.
- The service key is only imported from a `server-only` module and never reaches the browser.

## 10. Pass/Fail calculation

Ported from the old `lib/oiml.js` with its tests, as a pure TypeScript module (`lib/calc.ts`):

- `error_g = (indicated_kg − reference_kg) × 1000`
- `n = load_kg × 1000 ÷ e_g`
- Allowed-error multiplier: bands for the report's accuracy class, sorted by `max_n`; a band covers
  `(min_n, max_n]`, so a load exactly on a boundary uses the lower band; loads above the top band use
  the top band's multiplier. `max_n = null` means no upper limit.
- `allowed_error_g = multiplier × e_g`, doubled when `test_stage = 'in_service'`
- Reading result: Pass when `|error_g| ≤ allowed_error_g`, otherwise Fail
- Incomplete or invalid input gives no numbers (never NaN) and result Incomplete
- Report result: Pass only if there is at least one reading and every reading passes
- Non-blocking hint when `Max ÷ e` is outside the OIML R 76 Table 3 range for the class

The form calculates live in the browser using rules loaded from the database. Submit recalculates
on the server with the current rules and stores `error_g`, `allowed_error_g` and `result` on each
reading, plus `calculated_result` on the report. Later rule edits never change submitted reports.

## 11. Report numbers

A `before insert` trigger on `reports` increments `report_counters` for the current year
(`insert … on conflict (year) do update … returning`) and sets `report_no = 'VS-YYYY-NNN'`
(at least three digits). The row lock on the counter makes numbers unique even when two drafts are
created at the same moment. Numbers are assigned when the draft is created; a deleted draft leaves a
gap in the numbering.

## 12. Test conditions capture

Each of temperature and humidity stores a value and its source. Voltage is always typed in.

- **Typed in:** typing into a field sets its source to `manual` and clears `weather_confirmed`.
- **Connect sensor:** Web Bluetooth. Hidden when the browser has no Bluetooth support (Chrome/Edge on
  HTTPS or localhost only). Connects to a probe exposing the standard environmental sensing service
  (`0x181A`) and subscribes to temperature (`0x2A6E`, signed 16-bit, 0.01 °C) and humidity
  (`0x2A6F`, unsigned 16-bit, 0.01 %). Values update live; source `sensor`. On disconnect the last
  value stays and "Sensor disconnected" is shown. The service/characteristic IDs are constants in
  `lib/sensor.ts`. Probes with their own proprietary protocol are out of scope for v1.
- **Estimate from weather:** browser location → Open-Meteo current `temperature_2m` and
  `relative_humidity_2m` (no key). Source `weather`, shown with an "Estimated — please confirm" note
  and a confirm tick. Submit is blocked until confirmed. Location denied or network error shows a
  message and leaves the fields for typing.

## 13. Photos

- Private Supabase Storage bucket `report-photos`, path `{report_id}/{photo_id}.{ext}`
- Accepted: JPEG, PNG, WebP; up to 10 MB each
- Each photo has a kind (nameplate / display / setup / seals / other) and may be linked to one reading
- `taken_at` is read from the photo's EXIF date with exifr when present; otherwise empty
- Upload flow: upload file → insert `photos` row; if the row insert fails, the uploaded file is removed
- Upload and delete are allowed only on the creator's own draft (storage policies mirror §9)
- Deleting a draft deletes its photo files as well as its rows
- Failed uploads show a per-photo Retry button
- Shown as thumbnails on the report page and included when printing

## 14. Activity log

Plain-word entries:
Created draft · Deleted draft · Submitted report · Approved report · Failed report ·
Changed allowed error for Class III (500–2,000) · Added user · Changed role for [name]

Submit, review and rule changes write their entry inside the same database function as the change.
Draft create/delete and user changes write it from the server action straight after the change.
Draft autosaves are not logged.

## 15. Users

- Public sign-up is turned off in Supabase Auth.
- Admin adds a user with a temporary password via a server action (service client creates the auth
  user with email confirmed, then the `profiles` row; if the profile insert fails the auth user is deleted).
- Admin can change a user's role. An admin cannot remove their own admin role.
- A one-off script creates the first admin: `npm run create-first-admin -- <email> <password> <name>`.

## 16. When things go wrong

| Situation | What the user sees |
|---|---|
| Autosave fails | "Couldn't save — retrying" notice; retries with back-off; unsaved changes kept in the page |
| Signed out mid-task | Sent to sign-in, then back to the same page; the draft is intact (it was autosaved) |
| Sensor unsupported | Connect sensor button hidden |
| Sensor disconnects | Last value kept, "Sensor disconnected" shown, Reconnect button |
| Weather unavailable | "Couldn't get weather — please type the values" |
| Photo upload fails | That photo shows Retry; other photos unaffected |
| Submit not allowed | A list of what's missing (e.g. "2 readings incomplete", "Confirm weather values") |
| Someone else already acted (e.g. already reviewed) | "This report was already approved by [name]" and the page refreshes |
| Not allowed (wrong role) | Friendly "You don't have access to this page" |

## 17. Testing

- **Unit (Vitest):** the calculator (all ported cases: acceptance examples, every band boundary,
  in-service doubling, invalid input, report result, Table 3 hint, rules-as-data, plus `max_n = null`);
  labels; sensor value decoding; weather response parsing; submit-readiness checks; review options
  (calculated Fail offers only Fail report; failing a Pass requires a note).
- **Database rules:** an automated test script signs in as a technician, a reviewer and an admin
  against a separate **test** Supabase project (never the real one) and checks what each can and cannot
  do — e.g. a technician cannot edit a pending report, cannot change status, cannot call the database
  functions directly, cannot see the activity log; a reviewer cannot change readings; report numbers
  stay unique under parallel inserts; two simultaneous reviews of one report — only one succeeds.
- **End-to-end (Playwright):** technician creates a draft, fills it in, adds a photo, submits;
  reviewer approves; admin sees it on the dashboard and in the activity log.

## 18. Build order

1. Project setup, database schema and access rules, sign-in, roles, app shell in the light green style
2. Allowed-error rules, new report form, readings with live Pass/Fail, autosave, submit, delete draft
3. Reports list, report page, review (approve / fail), print
4. Admin: users, rules editing, activity log, dashboards
5. Connect sensor and estimate-from-weather buttons
6. Photos

Each step ends with its tests passing.

## 19. Out of scope for v1

Tamper-proof/blockchain verification · a separate admin login · sending a report back to draft ·
text search on reports · PDF generation (browser print is used) · password reset emails and forced
password change · email notifications · offline use · GPS on photos · proprietary Bluetooth probes ·
public sign-up · multiple labs/organisations.

## 20. Setup needed from the user

1. Create a new Supabase project for the app and a second one for automated tests.
2. In each, turn off public sign-ups (Authentication settings).
3. Put the app project's URL, anon/publishable key and service key in `veriscaleV2/.env.local`
   (never committed), and the test project's in `.env.test.local`.
4. Separately: rotate or delete the old project's keys, since they are in the public `veriscale` repo.

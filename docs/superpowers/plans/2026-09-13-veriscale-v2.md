# VeriScale V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the VeriScale V2 web app end to end — sign-in with roles, draft → pending → approved/failed test reports with live Pass/Fail, admin tools, sensor/weather capture and photos — in the light green theme with plain-language copy.

**Architecture:** Next.js 16 App Router (TypeScript) talks to Supabase. Row-level access rules, lock triggers and three transactional database functions are the real security boundary; server actions check roles and call them. Pure logic (calculation, labels, readiness, dashboard aggregation, sensor/weather parsing, photo validation) lives in `src/lib` and is unit-tested; SQL is tested in-process with PGlite plus small auth/storage stubs.

**Tech Stack:** Next.js 16.3, React 19.3, TypeScript (latest version Next.js supports), Tailwind CSS 4.3, @supabase/supabase-js 2.116 + @supabase/ssr 0.12, exifr 7, Vitest 5, @electric-sql/pglite 0.5, Playwright 1.63, tsx.

**Spec:** `docs/superpowers/specs/2026-09-13-veriscale-v2-design.md`

## Global Constraints

- Interface copy follows spec §3 exactly: statuses Draft / Pending / Approved / Failed; results Pass / Fail / Incomplete; sources Sensor / Typed in / Weather; "Allowed error", "Activity log". Never show SHA-256, hash, blockchain, anchor, MPE, verdict, sign-off, RLS, service role.
- All status/result/source/role/photo-kind words come from `src/lib/labels.ts`.
- No tamper-proof/blockchain code of any kind.
- Light green theme tokens (from `design-mockups/DashboardLight.dc.html`): page `#F6F7F8`, sidebar `#FBFBFB`, card `#FFFFFF`, border `#E8EAED`, ink `#15171C`, muted `#6B7079`, accent green `#1F9D55`, green text `#177A43`, black button `#111317`, pills green `#E6F5EC/#177A43`, amber `#FDF3DC/#8F6310`, red `#FCEBEA/#B3261E`, blue `#E8F0FC/#2459B8`; fonts Inter + IBM Plex Mono; card radius 14px.
- Chart colors (validated): accuracy class I `#2F6FDB`, II `#E0A030`, III `#8E5CD1`, IIII `#1F9D55`; submitted `#6DBE8C`, reviewed `#146B3E`; single-series line/area `#1F9D55`.
- The service/secret Supabase key is imported only from `src/lib/supabase/admin.ts`, which starts with `import 'server-only'`.
- Env names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (legacy anon / service_role keys also work in these slots).
- Nobody can change report contents after submit (enforced by trigger).
- Report numbers `VS-YYYY-NNN`, assigned by trigger at draft creation.
- Photos: JPEG/PNG/WebP, ≤ 10 MB, private bucket `report-photos`, path `{report_id}/{photo_id}.{ext}`.
- Commit after every task; messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

```
package.json · tsconfig.json · next.config.ts · postcss.config.mjs · vitest.config.ts
playwright.config.ts · .env.example · README.md
supabase/migrations/
  0001_schema.sql          types, tables, report-number trigger, lock triggers, rule seed
  0002_access_rules.sql    grants, row-level policies, current_user_role()
  0003_functions.sql       submit_report, review_report, update_allowed_error
  0004_storage.sql         report-photos bucket + storage policies
scripts/
  create-first-admin.ts    one-off first admin
  seed-test-users.ts       technician/reviewer/admin for the test project (e2e)
src/
  proxy.ts                 session refresh + redirect to /sign-in
  app/
    layout.tsx · globals.css · page.tsx (→ /dashboard)
    sign-in/page.tsx · sign-in/actions.ts
    (app)/layout.tsx       shell; requires a profile
    (app)/sign-out/actions.ts
    (app)/dashboard/page.tsx
    (app)/reports/page.tsx · (app)/reports/actions.ts
    (app)/reports/[id]/page.tsx
    (app)/admin/rules/page.tsx · actions.ts
    (app)/admin/users/page.tsx · actions.ts
    (app)/admin/activity/page.tsx
  lib/
    labels.ts · calc.ts · readiness.ts · dashboard.ts · format.ts · types.ts
    sensor.ts · weather.ts · photos.ts
    auth.ts                getProfile(), requireProfile(), requireRole()
    activity.ts            logActivity()
    data.ts                loadRules(), loadReport(), listReports(), dashboard queries
    supabase/client.ts · server.ts · admin.ts
  components/
    ui/        Button · Card · Pill · StatusPill · ResultText · Field · StatTile · PageHeader · EmptyState
    shell/     Sidebar · TopBar
    charts/    AreaChart (client, hover) · HalfDonut · GroupedBars
    report/    DraftEditor (client) · InstrumentSection · ConditionsSection · SensorButton · WeatherButton
               ReadingsTable · PhotosSection · SubmitBar · ReportView · ReviewPanel · NewReportButton
    admin/     RuleRow (client) · AddUserForm (client) · RoleSelect (client)
tests/
  unit/    calc · labels · readiness · dashboard · sensor · weather · photos · format
  db/      harness.ts (PGlite + stubs) · schema.test.ts · access.test.ts · functions.test.ts · storage.test.ts
  e2e/     golden-path.spec.ts (skips without E2E env)
```

---

### Task 1: Project scaffold

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`.

**Interfaces:** Produces npm scripts `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:db` (`vitest run tests/db`), `test:e2e` (`playwright test`), `create-first-admin`, `seed-test-users`; path alias `@/*` → `src/*`; Tailwind `@theme` tokens named `page, sidebar, card, line, ink, muted, green, green-ink, black, amber, amber-ink, red, red-ink, blue, blue-ink` plus fonts.

- [ ] Install dependencies at the versions in the header (TypeScript pinned to the newest version Next.js supports).
- [ ] Write configs; `globals.css` = `@import "tailwindcss";` + `@theme` tokens + print rules (`.no-print` hidden, white page).
- [ ] Placeholder home page redirecting to `/dashboard`.
- [ ] Run `npm run typecheck` and `npm run build` → both succeed.
- [ ] Commit `chore: scaffold Next.js app with Tailwind theme`.

### Task 2: Labels and Pass/Fail calculator (TDD)

**Files:** Create `src/lib/labels.ts`, `src/lib/calc.ts`, `src/lib/types.ts`; tests `tests/unit/labels.test.ts`, `tests/unit/calc.test.ts`.

**Interfaces (Produces):**
```ts
// types.ts
type Role = 'technician' | 'reviewer' | 'admin';
type ReportStatus = 'draft' | 'pending' | 'approved' | 'failed';
type AccuracyClass = 'I' | 'II' | 'III' | 'IIII';
type TestStage = 'initial' | 'in_service';
type ConditionSource = 'sensor' | 'manual' | 'weather';
type PhotoKind = 'nameplate' | 'display' | 'setup' | 'seals' | 'other';
type StoredResult = 'pass' | 'fail';
interface AllowedErrorRule { id: string; accuracy_class: AccuracyClass; min_n: number; max_n: number | null; multiplier: number }
interface ReadingInput { load_kg: number | string | null; reference_kg: number | string | null; indicated_kg: number | string | null }
// calc.ts
toNum(v: unknown): number | null
allowedErrorMultiplier(cls: AccuracyClass, n: number, rules: AllowedErrorRule[]): number | null
calculateReading(input: ReadingInput & { accuracy_class: AccuracyClass | null; interval_e_g: number | string | null; test_stage: TestStage }, rules): { errorG: number | null; allowedErrorG: number | null; result: 'pass' | 'fail' | 'incomplete' }
reportResult(results: Array<'pass'|'fail'|'incomplete'>): 'pass' | 'fail' | 'incomplete'
table3Hint(cls, maxKg, eG): string | null   // plain-language message or null
DEFAULT_RULES: AllowedErrorRule[]            // the 12 OIML R 76 bands, top band max_n = null
// labels.ts
STATUS_LABEL: Record<ReportStatus,string>; RESULT_LABEL; SOURCE_LABEL; ROLE_LABEL; PHOTO_KIND_LABEL
TEST_TYPES: Array<{ name: string; clause: string }>
ACCURACY_CLASS_OPTIONS: Array<{ value: AccuracyClass; label: string }>
```

- [ ] Port every case from the old `lib/oiml.test.js` (acceptance examples ±30 g PASS / ±10 g FAIL; Class III boundaries at n = 500, 2000, 10000 and just above; top band beyond; class I/II/IIII low bands; unknown class → null; in-service doubling to ±60 g; five invalid inputs → all null + incomplete; report result pass/fail/incomplete; Table 3 hint; rules-as-data) plus `max_n = null` treated as no upper limit.
- [ ] Labels test: every status/result/source/role/kind has a label and no label matches `/sha|hash|anchor|blockchain|mpe|verdict|sign-?off/i`.
- [ ] Run tests → fail; implement; run → pass.
- [ ] Commit `feat: pass/fail calculator and plain-language labels`.

### Task 3: Submit readiness and review options (TDD)

**Files:** Create `src/lib/readiness.ts`; test `tests/unit/readiness.test.ts`.

**Interfaces:**
```ts
interface DraftForReadiness { manufacturer; model; serial_number; accuracy_class; max_capacity_kg; interval_e_g; test_date; temperature_source; humidity_source; weather_confirmed: boolean }
submitProblems(report: DraftForReadiness, readings: ReadingInput[]): string[]
// messages: "Fill in: Manufacturer, Model" · "Add at least one reading" · "2 readings incomplete" / "1 reading incomplete" · "Confirm weather values"
reviewOptions(calculated: StoredResult | null): { canApprove: boolean; failNoteRequired: boolean }
// fail → { canApprove:false, failNoteRequired:false }; pass → { canApprove:true, failNoteRequired:true }
```
- [ ] Tests for each message, pluralisation, weather only when a source is `weather`, and both review cases.
- [ ] Implement; tests pass; commit `feat: submit readiness and review rules`.

### Task 4: Database schema + PGlite harness

**Files:** Create `supabase/migrations/0001_schema.sql`, `tests/db/harness.ts`, `tests/db/schema.test.ts`.

**Interfaces:** `harness.ts` exports `createDb(): Promise<Db>` (fresh PGlite with stubs: roles `anon`, `authenticated`, `service_role bypassrls`; schema `auth` with `auth.users(id uuid pk, email text)` and `auth.uid()` reading `request.jwt.claim.sub`; schema `storage` with `buckets`, `objects`, `foldername()`; then all migrations applied in order), `asUser(db, userId, fn)` (runs `fn` inside a transaction with `set local role authenticated` and the claim set), `asService(db, fn)`, `seedUser(db, {role, name}) → id`.

SQL contents (0001): enums `user_role, report_status, condition_source, photo_kind`; tables exactly as spec §8; `report_counters`; `set_report_number()` before-insert trigger (security definer); `set_updated_at()`; `guard_report_update()` before-update trigger — rejects (`REPORT_LOCKED`) content-column changes when `old.status <> 'draft'`, rejects changes to `report_no`, `created_by`, `created_at`, and rejects any status transition other than draft→pending, pending→approved, pending→failed (`BAD_STATUS_CHANGE`); `guard_report_delete()` — only drafts; `guard_child_rows()` on readings and photos — insert/update/delete rejected when the parent report exists and is not draft; seed 12 rules (top bands `max_n` null).

- [ ] Tests: numbers VS-YYYY-001, 002 sequentially; 20 parallel inserts give 20 unique numbers; content change on a pending report → `REPORT_LOCKED`; draft→approved → `BAD_STATUS_CHANGE`; delete pending report rejected; reading insert on pending report rejected; deleting a draft cascades readings; 12 rules seeded.
- [ ] Run → fail; write SQL/harness; run → pass. Commit `feat(db): schema, report numbers and lock triggers`.

### Task 5: Access rules

**Files:** Create `supabase/migrations/0002_access_rules.sql`, `tests/db/access.test.ts`.

SQL: `revoke all on all tables in schema public from anon, authenticated`; `current_user_role()` security definer; grants + policies per spec §9: select on profiles/rules/reports/readings/photos for authenticated; column-level `grant update (manufacturer, model, serial_number, accuracy_class, max_capacity_kg, interval_e_g, indicator_type, power_source, test_stage, test_date, temperature_c, temperature_source, humidity_pct, humidity_source, voltage_v, weather_confirmed, reference_weights, remarks) on reports`; update policy `created_by = auth.uid() and status = 'draft'` (using + with check); readings insert/update/delete (columns `id, report_id, test_type, clause, load_kg, reference_kg, indicated_kg, position`) and photos insert/delete for the owner of a draft parent; activity_log select only when `current_user_role() = 'admin'`; nothing for anon.

- [ ] Tests (as users): technician edits own draft ✓; edits someone else's draft ✗ (0 rows); sets status to pending directly ✗ (permission denied); edits `calculated_result` ✗; adds reading to own draft ✓ / others' ✗; reviewer updates readings ✗; technician/reviewer read activity_log → 0 rows, admin → rows; anon reads reports ✗.
- [ ] Commit `feat(db): row-level access rules`.

### Task 6: Database functions

**Files:** Create `supabase/migrations/0003_functions.sql`, `tests/db/functions.test.ts`.

**Interfaces:**
```sql
submit_report(p_report_id uuid, p_actor uuid, p_results jsonb, p_calculated text) returns text  -- report_no
  -- p_results: [{ "id": uuid, "error_g": num, "allowed_error_g": num, "result": "pass"|"fail" }]
  -- errors: REPORT_NOT_FOUND, NOT_OWNER, REPORT_NOT_DRAFT, RESULTS_MISMATCH (not every reading covered / empty)
review_report(p_report_id uuid, p_actor uuid, p_decision text, p_note text) returns void
  -- errors: REPORT_NOT_FOUND, NOT_ALLOWED (role), ALREADY_REVIEWED (status not pending; message includes reviewer name), APPROVE_NOT_ALLOWED, NOTE_REQUIRED
update_allowed_error(p_rule_id text, p_multiplier numeric, p_actor uuid) returns void
  -- errors: NOT_ALLOWED, BAD_VALUE, RULE_NOT_FOUND
```
Each locks the row (`for update`), writes its activity entry ("Submitted report", "Approved report", "Failed report", "Changed allowed error for Class III (500–2,000)") with actor name/role from profiles. `revoke execute … from public, anon, authenticated; grant execute … to service_role`.

- [ ] Tests: submit stores results + status pending + log; submit by non-owner, twice, or with missing reading rejected; review approve/fail paths incl. APPROVE_NOT_ALLOWED and NOTE_REQUIRED; second review → ALREADY_REVIEWED; technician calling functions as `authenticated` → permission denied; rule update logs message with "∞"-free range text ("above 10,000" for open top band).
- [ ] Commit `feat(db): submit, review and rule-change functions`.

### Task 7: Photo storage rules

**Files:** Create `supabase/migrations/0004_storage.sql`, `tests/db/storage.test.ts`.

SQL: insert bucket `report-photos` (private, 10485760 bytes, `{image/jpeg,image/png,image/webp}`) `on conflict do nothing`; policies on `storage.objects`: select for authenticated in that bucket; insert/delete when `(storage.foldername(name))[1]` is a draft report created by `auth.uid()`.

- [ ] Tests with the stub: owner uploads to own draft folder ✓; to pending report folder ✗; other technician ✗; reviewer reads ✓.
- [ ] Commit `feat(db): private photo bucket rules`.

### Task 8: Supabase clients, sign-in, shell and UI kit

**Files:** Create `src/lib/supabase/{client,server,admin}.ts`, `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/format.ts`, `src/app/sign-in/{page.tsx,actions.ts}`, `src/app/(app)/layout.tsx`, `src/app/(app)/sign-out/actions.ts`, `src/components/ui/*`, `src/components/shell/{Sidebar,TopBar}.tsx`; test `tests/unit/format.test.ts`.

**Interfaces:**
```ts
createBrowserSupabase(): SupabaseClient              // client.ts
createServerSupabase(): Promise<SupabaseClient>      // server.ts (cookies getAll/setAll)
createAdminSupabase(): SupabaseClient                // admin.ts, server-only
getProfile(): Promise<Profile | null>; requireProfile(): Promise<Profile>; requireRole(roles: Role[]): Promise<Profile>
interface Profile { id: string; full_name: string; email: string; role: Role }
formatDate(d) "11 Sep 2026" · formatDateTime(d) "11 Sep 2026, 16:05" · formatGrams(n) "+20.0 g" · formatAllowed(n) "± 25.0 g" · formatKg(n) "10.000"
```
Sidebar (spec §7): technician — Dashboard, Reports; reviewer — Pending review (count), Dashboard, Reports; admin — Pending review (count), Dashboard, Reports, Rules, Users, Activity log; user card + sign out at bottom. Proxy redirects signed-out users to `/sign-in?next=…`; sign-in returns to `next`. Wrong-role pages render "You don't have access to this page".

- [ ] format tests pass; typecheck + build pass. Commit `feat: sign-in, app shell and UI kit`.

### Task 9: Report actions, list, report page and review

**Files:** Create `src/lib/activity.ts`, `src/lib/data.ts`, `src/app/(app)/reports/{page.tsx,actions.ts}`, `src/app/(app)/reports/[id]/page.tsx`, `src/components/report/{ReportView,ReviewPanel,NewReportButton}.tsx`, `src/components/ui/StatusPill.tsx`.

**Interfaces:**
```ts
// actions.ts ('use server'); all return { ok: true, … } | { ok: false, error: string } with plain messages
createDraft(): redirects to /reports/[id]
deleteDraft(reportId: string)
saveDraftFields(reportId: string, fields: Partial<EditableReportFields>)
saveReadings(reportId: string, readings: Array<{ id; test_type; clause; load_kg; reference_kg; indicated_kg; position }>)
submitReport(reportId: string)          // loads report+readings+rules, recalculates, checks submitProblems, calls submit_report
reviewReport(reportId: string, decision: 'approved' | 'failed', note: string)
// data.ts
loadRules(sb): AllowedErrorRule[]; loadReport(sb, id): FullReport | null; listReports(sb, status?: ReportStatus): ReportListItem[]
logActivity(actor: Profile, message: string, reportNo?: string)
```
Database error codes map to plain messages (e.g. `ALREADY_REVIEWED` → "This report was already approved by Kavya Rao").

- [ ] Reports list with status filter tabs; report page renders ReportView for non-editable cases (instrument, conditions with source pills, readings with stored results, reviewer + note, Print button), ReviewPanel for reviewers/admins on pending reports using `reviewOptions`.
- [ ] typecheck + unit + db tests + build pass. Commit `feat: reports list, report page and review`.

### Task 10: Draft editor

**Files:** Create `src/components/report/{DraftEditor,InstrumentSection,ConditionsSection,ReadingsTable,SubmitBar}.tsx`; modify `src/app/(app)/reports/[id]/page.tsx` to render DraftEditor for the creator's own draft.

Behaviour: local state; debounced (1000 ms) `saveDraftFields` / `saveReadings`; save status "Saved" / "Saving…" / "Couldn't save — retrying" with back-off (1s, 2s, 4s, max 30s); readings table with live `calculateReading` using rules passed from the server; Table 3 hint; typing in temperature/humidity sets source `manual` and clears `weather_confirmed`; SubmitBar shows overall result and `submitProblems` list, Submit disabled while problems exist; Delete draft with confirm.

- [ ] typecheck + build pass. Commit `feat: draft editor with autosave and live pass/fail`.

### Task 11: Admin pages

**Files:** Create `src/app/(app)/admin/rules/{page.tsx,actions.ts}`, `src/app/(app)/admin/users/{page.tsx,actions.ts}`, `src/app/(app)/admin/activity/page.tsx`, `src/components/admin/{RuleRow,AddUserForm,RoleSelect}.tsx`.

**Interfaces:**
```ts
updateRule(ruleId: string, multiplier: number)          // requireRole(['admin']) → update_allowed_error
addUser(input: { fullName; email; password; role })     // auth.admin.createUser(email_confirm) → profiles insert → rollback deleteUser on failure → log "Added user"
changeRole(userId: string, role: Role)                  // blocks own admin removal → log "Changed role for [name]"
```
- [ ] Rules table (class, load range in scale steps, allowed error ± value e, edit inline), users form + list with role select, activity log table newest first (limit 200).
- [ ] typecheck + build pass. Commit `feat: admin rules, users and activity log`.

### Task 12: Dashboards and charts

**Files:** Create `src/lib/dashboard.ts`, `tests/unit/dashboard.test.ts`, `src/components/charts/{AreaChart,HalfDonut,GroupedBars}.tsx`, `src/components/ui/StatTile.tsx`, `src/app/(app)/dashboard/page.tsx`.

**Interfaces:**
```ts
statusCounts(reports): { all; draft; pending; approved; failed }
weeklySubmitted(reports, now: Date, weeks = 12): Array<{ weekStart: Date; count: number }>   // weeks start Monday
classCounts(reports): Record<AccuracyClass, number>                                        // submitted reports only
submittedVsReviewed(reports, now, weeks = 6): Array<{ weekStart; submitted; reviewed }>
```
- [ ] Unit tests for bucketing (Monday boundaries, empty weeks = 0, drafts excluded).
- [ ] Admin dashboard = light green mockup; technician = my drafts + recent; reviewer = pending queue oldest first + recent decisions. Empty states in plain words.
- [ ] Commit `feat: role dashboards with charts`.

### Task 13: Sensor and weather

**Files:** Create `src/lib/sensor.ts`, `src/lib/weather.ts`, `tests/unit/{sensor,weather}.test.ts`, `src/components/report/{SensorButton,WeatherButton}.tsx`; modify `ConditionsSection.tsx`.

**Interfaces:**
```ts
ESS_SERVICE = 0x181a; TEMPERATURE_CHAR = 0x2a6e; HUMIDITY_CHAR = 0x2a6f
decodeTemperature(view: DataView): number   // sint16 LE ÷ 100
decodeHumidity(view: DataView): number      // uint16 LE ÷ 100
isBluetoothSupported(): boolean
connectSensor(handlers: { onTemperature(c: number); onHumidity(p: number); onDisconnect() }): Promise<{ name: string; disconnect(): void }>
buildWeatherUrl(lat: number, lon: number): string
parseWeather(json: unknown): { temperatureC: number; humidityPct: number }   // throws WeatherError on bad shape
getWeatherEstimate(): Promise<{ temperatureC; humidityPct }>                  // geolocation → fetch → parse
```
- [ ] Tests: negative temperature decoding (-5.25 °C), humidity 47.5 %, URL params, parse success and bad shape.
- [ ] UI: SensorButton hidden when unsupported; live values; "Sensor disconnected" + Reconnect; WeatherButton fills values with source weather, shows "Estimated — please confirm" + confirm tick, error message on failure.
- [ ] Commit `feat: connect sensor and weather estimate`.

### Task 14: Photos

**Files:** Create `src/lib/photos.ts`, `tests/unit/photos.test.ts`, `src/components/report/PhotosSection.tsx`; modify reports `actions.ts` (add `addPhoto`, `removePhoto`, delete files in `deleteDraft`), `ReportView.tsx` (thumbnails via signed URLs), `data.ts`.

**Interfaces:**
```ts
MAX_PHOTO_BYTES = 10 * 1024 * 1024; ACCEPTED_TYPES = ['image/jpeg','image/png','image/webp']
validatePhoto(file: { type: string; size: number }): string | null   // plain error or null
photoPath(reportId: string, photoId: string, type: string): string   // "{report}/{photo}.jpg|png|webp"
readTakenAt(file: Blob): Promise<string | null>                      // exifr DateTimeOriginal → ISO
addPhoto(reportId, { id, kind, storagePath, takenAt, readingId })    // server action; on insert failure removes the file
removePhoto(reportId, photoId)
```
- [ ] Tests: type/size validation messages, path extension mapping.
- [ ] UI: pick kind + optional reading, upload with progress state, per-photo Retry, remove; read-only thumbnails grid on report page; printed.
- [ ] Commit `feat: report photos`.

### Task 15: Scripts, end-to-end test, docs, final verification and push

**Files:** Create `scripts/create-first-admin.ts`, `scripts/seed-test-users.ts`, `playwright.config.ts`, `tests/e2e/golden-path.spec.ts`, `README.md`.

- [ ] `create-first-admin`: args email password name → auth user (email confirmed) + admin profile; loads `.env.local`.
- [ ] `seed-test-users`: creates tech/reviewer/admin in the project from `.env.test.local`, prints credentials to set as `E2E_*` env vars.
- [ ] Golden path spec: technician signs in → New report → fills instrument, conditions, one reading → uploads a small PNG → Submit; reviewer approves; admin sees report on dashboard and "Approved report" in activity log. `test.skip` when `E2E_TECH_EMAIL` etc. are missing.
- [ ] README: what it is, setup (spec §20 steps, applying migrations in order via the Supabase SQL editor, first admin), scripts, testing.
- [ ] Final verification: `npm run typecheck`, `npm test` (unit + db), `npm run build` — all pass; copy scan for banned words in `src/`.
- [ ] Commit `docs: setup guide, scripts and end-to-end test`; `git push origin main`.

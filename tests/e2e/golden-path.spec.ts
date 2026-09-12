import { expect, test, type Page } from '@playwright/test';

// Full walkthrough against the TEST Supabase project:
// technician creates and submits a report with a photo, reviewer approves,
// admin sees it on the dashboard and in the activity log.

type Credentials = { email: string; password: string };

const account = (key: 'TECH' | 'REVIEWER' | 'ADMIN'): Credentials | null => {
  const email = process.env[`E2E_${key}_EMAIL`];
  const password = process.env[`E2E_${key}_PASSWORD`];
  return email && password ? { email, password } : null;
};

const tech = account('TECH');
const reviewer = account('REVIEWER');
const admin = account('ADMIN');

// A 1×1 PNG, so the test needs no image files.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function signIn(page: Page, who: Credentials) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

test.skip(!tech || !reviewer || !admin, 'Set the E2E_* accounts in .env.test.local (run `npm run seed-test-users`).');

test('technician submits a report, reviewer approves it, admin sees it', async ({ page }) => {
  // Technician: create and fill a draft
  await signIn(page, tech!);
  await page.getByRole('button', { name: 'New report' }).click();
  await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
  const reportUrl = page.url();
  const reportNo = (await page.getByRole('navigation', { name: 'Breadcrumb' }).locator('span').last().innerText()).trim();
  expect(reportNo).toMatch(/^VS-\d{4}-\d{3,}$/);

  await page.getByLabel('Manufacturer').fill('End-to-end Scales Ltd');
  await page.getByLabel('Model').fill('E2E-150');
  await page.getByLabel('Serial number').fill(`E2E-${Date.now()}`);
  await page.getByLabel('Accuracy class').selectOption('III');
  await page.getByLabel('Maximum capacity').fill('150');
  await page.getByLabel('Verification interval (e)').fill('50');
  await page.getByLabel('Temperature').fill('22.5');
  await page.getByLabel('Humidity').fill('48');
  await page.getByLabel('Supply voltage').fill('230');

  await page.getByRole('button', { name: 'Add reading' }).click();
  await page.getByLabel('Weighing accuracy load in kg, row 1').fill('10');
  await page.getByLabel('Weighing accuracy reference in kg, row 1').fill('10');
  await page.getByLabel('Weighing accuracy indicated in kg, row 1').fill('10.02');
  await expect(page.getByText('Overall result:')).toContainText('Pass');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 20_000 });

  // Photo
  await page.locator('input[type="file"]').setInputFiles({ name: 'nameplate.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('button', { name: 'Remove Nameplate photo' })).toBeVisible({ timeout: 30_000 });

  // Submit
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByText('Readings result:')).toBeVisible({ timeout: 30_000 });
  await signOut(page);

  // Reviewer: approve
  await signIn(page, reviewer!);
  await page.goto(reportUrl);
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole('main').getByText('Approved', { exact: true }).first()).toBeVisible();
  await signOut(page);

  // Admin: dashboard and activity log
  await signIn(page, admin!);
  await expect(page.getByText(reportNo).first()).toBeVisible();
  await page.goto('/admin/activity');
  await expect(page.getByRole('row').filter({ hasText: reportNo }).filter({ hasText: 'Approved report' })).toBeVisible();
});

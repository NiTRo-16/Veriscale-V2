// Creates (or resets) a technician, reviewer and admin in the TEST Supabase
// project for the end-to-end test, and prints the lines for .env.test.local.
// Usage: npm run seed-test-users
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test.local' });

const USERS = [
  { key: 'TECH', email: 'e2e-technician@veriscale.test', fullName: 'Test Technician', role: 'technician' },
  { key: 'REVIEWER', email: 'e2e-reviewer@veriscale.test', fullName: 'Test Reviewer', role: 'reviewer' },
  { key: 'ADMIN', email: 'e2e-admin@veriscale.test', fullName: 'Test Admin', role: 'admin' },
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error('Put the TEST project URL and secret key in .env.test.local first.');
    process.exit(1);
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  const lines: string[] = [];
  for (const user of USERS) {
    const password = randomBytes(12).toString('base64url');
    let id = existing.users.find((u) => u.email === user.email)?.id;

    if (id) {
      const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true });
      if (error) throw error;
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: user.email, password, email_confirm: true });
      if (error || !data.user) throw error ?? new Error(`Couldn't create ${user.email}`);
      id = data.user.id;
    }

    const { error: profileError } = await admin
      .from('profiles')
      .upsert({ id, full_name: user.fullName, email: user.email, role: user.role }, { onConflict: 'id' });
    if (profileError) throw profileError;

    lines.push(`E2E_${user.key}_EMAIL=${user.email}`, `E2E_${user.key}_PASSWORD=${password}`);
  }

  console.log('Test accounts are ready. Add these lines to .env.test.local:\n');
  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

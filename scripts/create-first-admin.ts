// Creates the very first admin account.
// Usage: npm run create-first-admin -- <email> <password> <full name>
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(' ').trim();

  if (!email || !password || !fullName) {
    console.error('Usage: npm run create-first-admin -- <email> <password> <full name>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('The password needs at least 8 characters.');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first (see .env.example).');
    process.exit(1);
  }

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { count, error: countError } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin');
  if (countError) {
    console.error(`Couldn't check existing accounts: ${countError.message}. Have you run the migrations?`);
    process.exit(1);
  }
  if ((count ?? 0) > 0) {
    console.error('An admin already exists. Sign in as that admin and add more people from the Users page.');
    process.exit(1);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    console.error(`Couldn't create the account: ${error?.message ?? 'unknown error'}`);
    process.exit(1);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, full_name: fullName, email: email.trim().toLowerCase(), role: 'admin' });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    console.error(`Couldn't save the admin profile: ${profileError.message}`);
    process.exit(1);
  }

  await admin
    .from('activity_log')
    .insert({ actor_id: data.user.id, actor_name: fullName, actor_role: 'admin', message: 'Created the first admin account' });

  console.log(`Admin account created for ${fullName} (${email}). Sign in at /sign-in.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

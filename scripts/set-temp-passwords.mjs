// One-off admin utility: set temporary passwords for the existing accounts that
// were created via magic link (they have no password the user chose). Uses the
// Supabase admin API — run it yourself with the service-role key; nothing here
// is committed with a secret, and the passwords are generated fresh each run.
//
// Usage (from the project root):
//   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/set-temp-passwords.mjs
//
// The service-role key is in Supabase → Settings → API → service_role (secret).
// It prints an email → temporary-password table for you to share privately;
// each person should change theirs from Your School → Password after logging in.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const SUPABASE_URL = "https://bryuqdnfobncfclomtti.supabase.co"; // public project URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Get it from Supabase → Settings → API → service_role, then:");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=... node scripts/set-temp-passwords.mjs");
  process.exit(1);
}

// Accounts to (re)set. Edit this list as needed.
const EMAILS = [
  "heather@globalschoolalliance.com",
  "thomas@globalschoolalliance.com",
  "thomascamilleri@me.com",
  "ras@thirdharmonic.co.uk",
  "ras.fernando1@gmail.com",
];

const tempPassword = () => "Gsa-" + randomBytes(9).toString("base64url") + "-42";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Page through users to map email → id.
const byEmail = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) { console.error("listUsers failed:", error.message); process.exit(1); }
  for (const u of data.users) if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
  if (data.users.length < 200) break;
}

const results = [];
for (const email of EMAILS) {
  const id = byEmail.get(email.toLowerCase());
  if (!id) { results.push([email, "(not found — skipped)"]); continue; }
  const password = tempPassword();
  const { error } = await supabase.auth.admin.updateUserById(id, {
    password,
    email_confirm: true, // confirm the email so they can sign in immediately
  });
  results.push([email, error ? `FAILED: ${error.message}` : password]);
}

console.log("\nTemporary passwords (share each privately; users change it after first login):\n");
for (const [email, pw] of results) console.log(`  ${email.padEnd(38)}  ${pw}`);
console.log("");

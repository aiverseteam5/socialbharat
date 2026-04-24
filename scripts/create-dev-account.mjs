/**
 * Create a dev/QA account in Supabase: confirmed user + organization + owner membership.
 * Usage: node scripts/create-dev-account.mjs
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local.
 * Prints the generated password ONCE — copy it immediately.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

// Minimal .env.local loader (no dotenv dep)
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
  if (!m) continue;
  let value = m[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  } else {
    // Strip inline comment ` # ...` only when value isn't quoted
    const hash = value.indexOf("#");
    if (hash !== -1 && /\s/.test(value[hash - 1] ?? " ")) {
      value = value.slice(0, hash).trim();
    }
  }
  if (!process.env[m[1]]) process.env[m[1]] = value;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const stamp = Date.now().toString(36);
const email = `dev+qa-${stamp}@socialbharat.in`;
const password = randomBytes(12).toString("base64url");
const orgName = `QA Org ${stamp}`;
const orgSlug = `qa-org-${stamp}`;
const fullName = "QA Admin";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authErr || !created.user) {
    throw new Error(`createUser failed: ${authErr?.message}`);
  }
  const userId = created.user.id;

  const { error: profileErr } = await admin
    .from("users")
    .insert({ id: userId, email, full_name: fullName });
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`insert users failed: ${profileErr.message}`);
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: orgName, slug: orgSlug, plan: "business" })
    .select("id")
    .single();
  if (orgErr || !org) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`insert organizations failed: ${orgErr?.message}`);
  }

  const { error: memberErr } = await admin.from("org_members").insert({
    org_id: org.id,
    user_id: userId,
    role: "owner",
    accepted_at: new Date().toISOString(),
  });
  if (memberErr) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`insert org_members failed: ${memberErr.message}`);
  }

  console.log("\n=== DEV ACCOUNT CREATED ===");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Org:      ${orgName} (${org.id})`);
  console.log(`Role:     owner`);
  console.log(`Plan:     business`);
  console.log("===========================\n");
  console.log("Login at /login. Reset the password from Supabase dashboard when done.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

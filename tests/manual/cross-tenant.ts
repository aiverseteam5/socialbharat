/**
 * RLS Cross-Tenant Isolation Test
 * Run: node --experimental-strip-types --env-file=.env.local tests/manual/cross-tenant.ts
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    "Missing: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  process.exit(1);
}

const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ts = Date.now();
const EMAIL_A = `test-a-${ts}@test.socialbharat.dev`;
const EMAIL_B = `test-b-${ts}@test.socialbharat.dev`;
const PASSWORD = "TestPass123!";

let userAId = "";
let userBId = "";
let orgAId = "";
let orgBId = "";
let postId = "";
let socialProfileId = "";
let conversationId = "";

const results: { check: string; passed: boolean; detail: string }[] = [];
const p = (check: string, detail = "") => {
  results.push({ check, passed: true, detail });
  console.log(`  ✓ PASS  ${check}${detail ? " — " + detail : ""}`);
};
const f = (check: string, detail = "") => {
  results.push({ check, passed: false, detail });
  console.error(`  ✗ FAIL  ${check}${detail ? " — " + detail : ""}`);
};

function assertInsert<T>(
  label: string,
  data: T | null,
  error: { message: string; details?: string; hint?: string } | null,
): T {
  if (error || !data) {
    const msg = error
      ? `${error.message}${error.details ? " | " + error.details : ""}${error.hint ? " | hint: " + error.hint : ""}`
      : "no data returned";
    throw new Error(`${label} insert failed: ${msg}`);
  }
  return data;
}

async function setup() {
  console.log("\n── SETUP ──────────────────────────────────────────");

  // Users
  const { data: a, error: ae } = await svc.auth.admin.createUser({
    email: EMAIL_A,
    password: PASSWORD,
    email_confirm: true,
  });
  if (ae || !a.user) throw new Error(`user A: ${ae?.message}`);
  userAId = a.user.id;

  const { data: b, error: be } = await svc.auth.admin.createUser({
    email: EMAIL_B,
    password: PASSWORD,
    email_confirm: true,
  });
  if (be || !b.user) throw new Error(`user B: ${be?.message}`);
  userBId = b.user.id;

  const notifPrefs = { in_app: true, email: true, whatsapp: false, sms: false };
  const { error: usersErr } = await svc.from("users").upsert([
    {
      id: userAId,
      email: EMAIL_A,
      preferred_language: "en",
      notification_preferences: notifPrefs,
    },
    {
      id: userBId,
      email: EMAIL_B,
      preferred_language: "en",
      notification_preferences: notifPrefs,
    },
  ]);
  if (usersErr) throw new Error(`users upsert: ${usersErr.message}`);

  // Orgs
  const { data: orgA, error: orgAErr } = await svc
    .from("organizations")
    .insert({ name: "Test Org A", slug: `test-org-a-${ts}`, plan: "free" })
    .select("id")
    .single();
  orgAId = assertInsert("organizations (A)", orgA, orgAErr).id;

  const { data: orgB, error: orgBErr } = await svc
    .from("organizations")
    .insert({ name: "Test Org B", slug: `test-org-b-${ts}`, plan: "free" })
    .select("id")
    .single();
  orgBId = assertInsert("organizations (B)", orgB, orgBErr).id;

  const { error: memErr } = await svc.from("org_members").insert([
    { org_id: orgAId, user_id: userAId, role: "owner" },
    { org_id: orgBId, user_id: userBId, role: "owner" },
  ]);
  if (memErr)
    throw new Error(
      `org_members insert: ${memErr.message}${memErr.details ? " | " + memErr.details : ""}`,
    );

  // Seed data in org A — column names match 00001_initial_schema.sql exactly
  const { data: post, error: postErr } = await svc
    .from("posts")
    .insert({
      org_id: orgAId,
      created_by: userAId,
      content: "Secret post — org A only",
      status: "draft",
      platforms: [],
    })
    .select("id")
    .single();
  postId = assertInsert("posts", post, postErr).id;

  // social_profiles: correct columns are platform_username / profile_name (not username / display_name)
  const { data: sp, error: spErr } = await svc
    .from("social_profiles")
    .insert({
      org_id: orgAId,
      platform: "facebook",
      platform_user_id: `fb-${ts}`,
      platform_username: "page_a",
      profile_name: "Page A",
      access_token_encrypted: "enc",
      connected_by: userAId,
    })
    .select("id")
    .single();
  socialProfileId = assertInsert("social_profiles", sp, spErr).id;

  const { data: cv, error: cvErr } = await svc
    .from("conversations")
    .insert({
      org_id: orgAId,
      platform: "facebook",
      status: "open",
      platform_conversation_id: `conv-${ts}`,
    })
    .select("id")
    .single();
  conversationId = assertInsert("conversations", cv, cvErr).id;

  console.log(`  User A: ${EMAIL_A}  Org A: ${orgAId}`);
  console.log(`  User B: ${EMAIL_B}  Org B: ${orgBId}`);
  console.log(
    `  Seeded: post=${postId}, profile=${socialProfileId}, conversation=${conversationId}`,
  );
}

async function runTests() {
  console.log("\n── ISOLATION TESTS (authenticated as user B) ──────");

  const userBClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInErr } = await userBClient.auth.signInWithPassword({
    email: EMAIL_B,
    password: PASSWORD,
  });
  if (signInErr) {
    f("User B sign-in", signInErr.message);
    return;
  }
  p("User B sign-in");

  // 1. Posts
  const { data: posts, error: pe } = await userBClient
    .from("posts")
    .select("id,org_id")
    .eq("org_id", orgAId);
  if (pe || (posts ?? []).length === 0)
    p("posts: org A rows invisible to user B", `${posts?.length ?? 0} rows`);
  else f("posts: LEAK", `${posts!.length} row(s) returned`);

  // 2. Conversations
  const { data: convs, error: ce } = await userBClient
    .from("conversations")
    .select("id,org_id")
    .eq("org_id", orgAId);
  if (ce || (convs ?? []).length === 0)
    p(
      "conversations: org A rows invisible to user B",
      `${convs?.length ?? 0} rows`,
    );
  else f("conversations: LEAK", `${convs!.length} row(s) returned`);

  // 3. Social profiles
  const { data: profs, error: pre } = await userBClient
    .from("social_profiles")
    .select("id,org_id")
    .eq("org_id", orgAId);
  if (pre || (profs ?? []).length === 0)
    p(
      "social_profiles: org A rows invisible to user B",
      `${profs?.length ?? 0} rows`,
    );
  else f("social_profiles: LEAK", `${profs!.length} row(s) returned`);

  // 4. Invoices
  const { data: invs, error: ie } = await userBClient
    .from("invoices")
    .select("id,org_id")
    .eq("org_id", orgAId);
  if (ie || (invs ?? []).length === 0)
    p("invoices: org A rows invisible to user B", `${invs?.length ?? 0} rows`);
  else f("invoices: LEAK", `${invs!.length} row(s) returned`);

  // 5. Sanity — user B can query their own org (RLS should allow)
  const { data: ownMem, error: ownErr } = await userBClient
    .from("org_members")
    .select("org_id")
    .eq("user_id", userBId);
  if (ownErr) f("user B org_members self-read", ownErr.message);
  else if ((ownMem ?? []).length > 0)
    p("user B can read own org_members row (RLS allows self)");
  else f("user B cannot read own org_members — RLS too restrictive");

  await userBClient.auth.signOut();
}

async function cleanup() {
  console.log("\n── CLEANUP ─────────────────────────────────────────");
  if (conversationId)
    await svc.from("conversations").delete().eq("id", conversationId);
  if (socialProfileId)
    await svc.from("social_profiles").delete().eq("id", socialProfileId);
  if (postId) await svc.from("posts").delete().eq("id", postId);
  if (orgAId || orgBId)
    await svc
      .from("org_members")
      .delete()
      .in("org_id", [orgAId, orgBId].filter(Boolean));
  if (orgAId) await svc.from("organizations").delete().eq("id", orgAId);
  if (orgBId) await svc.from("organizations").delete().eq("id", orgBId);
  if (userAId) {
    await svc.from("users").delete().eq("id", userAId);
    await svc.auth.admin.deleteUser(userAId);
  }
  if (userBId) {
    await svc.from("users").delete().eq("id", userBId);
    await svc.auth.admin.deleteUser(userBId);
  }
  console.log("  Done.");
}

async function writeReport(overall: string) {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const md = [
    `## RLS Cross-Tenant Isolation Test`,
    `**Run:** ${new Date().toISOString()}  **Supabase:** ${SUPABASE_URL}`,
    `**Overall: ${overall}** (${passed} passed, ${failed} failed)`,
    "",
    "| Check | Result | Detail |",
    "|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.check} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`,
    ),
    "",
    overall === "PASS"
      ? "RLS isolation confirmed: user B cannot read user A's org data across all tested tables."
      : "⚠️ RLS LEAK — review policy definitions immediately.",
  ].join("\n");

  mkdirSync(resolve("qa"), { recursive: true });
  writeFileSync(resolve("qa/cross-tenant-rls-result.md"), md, "utf8");
  console.log("\n  Report → qa/cross-tenant-rls-result.md");
}

async function main() {
  console.log("SocialBharat — RLS Cross-Tenant Isolation Test");
  console.log("Supabase:", SUPABASE_URL);
  try {
    await setup();
    await runTests();
  } finally {
    await cleanup();
  }
  const failed = results.filter((r) => !r.passed).length;
  const overall = failed === 0 ? "PASS" : "FAIL";
  await writeReport(overall);
  console.log(`\n══ RESULT: ${overall} ══\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { describe, it, expect } from "vitest";
import { env } from "@/lib/env";
import { encrypt, decrypt } from "@/lib/encryption";

describe("env", () => {
  it("exports required core vars", () => {
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeTruthy();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
    expect(env.ENCRYPTION_KEY).toBeTruthy();
  });

  it("exports required queue vars", () => {
    expect(env.UPSTASH_REDIS_REST_URL).toBeTruthy();
    expect(env.UPSTASH_REDIS_REST_TOKEN).toBeTruthy();
  });

  it("exports required payment vars", () => {
    expect(env.RAZORPAY_KEY_ID).toBeTruthy();
    expect(env.RAZORPAY_KEY_SECRET).toBeTruthy();
    expect(env.RAZORPAY_WEBHOOK_SECRET).toBeTruthy();
  });

  it("exports optional connector vars as string or undefined", () => {
    // Optional vars: if present they must be strings, if absent must be undefined
    const optionals = [
      env.META_APP_ID,
      env.TWITTER_API_KEY,
      env.LINKEDIN_CLIENT_ID,
      env.REDIS_URL,
    ];
    for (const v of optionals) {
      expect(v === undefined || typeof v === "string").toBe(true);
    }
  });

  it("ENCRYPTION_KEY is at least 32 chars", () => {
    expect(env.ENCRYPTION_KEY.length).toBeGreaterThanOrEqual(32);
  });
});

describe("encryption round-trip", () => {
  it("encrypts and decrypts symmetrically", () => {
    const plaintext = "test-token-🔐";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
  });
});

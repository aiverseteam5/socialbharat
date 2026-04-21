import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { generatePkcePair } from "@/lib/oauth-pkce";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

describe("generatePkcePair", () => {
  it("produces a verifier within RFC 7636 length bounds (43-128 chars)", () => {
    const { verifier } = generatePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("produces a verifier using only unreserved base64url characters", () => {
    const { verifier } = generatePkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a challenge equal to base64url(sha256(verifier))", () => {
    const { verifier, challenge } = generatePkcePair();
    const expected = base64url(createHash("sha256").update(verifier).digest());
    expect(challenge).toBe(expected);
  });

  it("produces unique verifier/challenge pairs across calls", () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(b.challenge);
  });

  it("produces a challenge without base64 padding", () => {
    const { challenge } = generatePkcePair();
    expect(challenge).not.toContain("=");
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
  });
});

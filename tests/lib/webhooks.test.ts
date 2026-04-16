import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyRazorpaySignature,
  verifyMetaSignature,
} from "@/lib/webhooks/verify";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({
  event: "payment.captured",
  id: "pay_123",
  amount: 50000,
});

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyRazorpaySignature", () => {
  it("returns true for a valid signature", () => {
    const sig = sign(BODY, SECRET);
    expect(verifyRazorpaySignature(BODY, sig, SECRET)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const sig = sign(BODY, SECRET);
    expect(verifyRazorpaySignature(BODY + "x", sig, SECRET)).toBe(false);
  });

  it("returns false for a wrong secret", () => {
    const sig = sign(BODY, SECRET);
    expect(verifyRazorpaySignature(BODY, sig, "other-secret")).toBe(false);
  });

  it("returns false when signature is missing", () => {
    expect(verifyRazorpaySignature(BODY, null, SECRET)).toBe(false);
    expect(verifyRazorpaySignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyRazorpaySignature(BODY, "", SECRET)).toBe(false);
  });

  it("returns false when secret is empty", () => {
    const sig = sign(BODY, SECRET);
    expect(verifyRazorpaySignature(BODY, sig, "")).toBe(false);
  });

  it("returns false for a signature of a different length", () => {
    expect(verifyRazorpaySignature(BODY, "abc123", SECRET)).toBe(false);
  });
});

describe("verifyMetaSignature", () => {
  const header = (body: string, secret: string) =>
    `sha256=${sign(body, secret)}`;

  it("returns true for a valid sha256=... header", () => {
    expect(verifyMetaSignature(BODY, header(BODY, SECRET), SECRET)).toBe(true);
  });

  it("returns false when the sha256= prefix is missing", () => {
    expect(verifyMetaSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(false);
  });

  it("returns false for a tampered body", () => {
    expect(verifyMetaSignature(BODY + "x", header(BODY, SECRET), SECRET)).toBe(
      false,
    );
  });

  it("returns false for a wrong app secret", () => {
    expect(
      verifyMetaSignature(BODY, header(BODY, SECRET), "other-secret"),
    ).toBe(false);
  });

  it("returns false when header is missing", () => {
    expect(verifyMetaSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyMetaSignature(BODY, "", SECRET)).toBe(false);
  });

  it("returns false when app secret is empty", () => {
    expect(verifyMetaSignature(BODY, header(BODY, SECRET), "")).toBe(false);
  });
});

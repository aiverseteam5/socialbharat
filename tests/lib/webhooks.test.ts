import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyRazorpaySignature,
  verifyMetaSignature,
  verifyTwitterSignature,
  twitterCrcResponseToken,
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

describe("twitterCrcResponseToken", () => {
  it("returns sha256=<base64> for a given crc_token + consumer secret", () => {
    const crc = "test-crc-token";
    const expected =
      "sha256=" + createHmac("sha256", SECRET).update(crc).digest("base64");
    expect(twitterCrcResponseToken(crc, SECRET)).toBe(expected);
  });
});

describe("verifyTwitterSignature", () => {
  const twitterSign = (body: string, secret: string) =>
    "sha256=" + createHmac("sha256", secret).update(body).digest("base64");

  it("returns true for a valid signature", () => {
    expect(
      verifyTwitterSignature(BODY, twitterSign(BODY, SECRET), SECRET),
    ).toBe(true);
  });

  it("returns false for a tampered body", () => {
    expect(
      verifyTwitterSignature(BODY + "x", twitterSign(BODY, SECRET), SECRET),
    ).toBe(false);
  });

  it("returns false for a wrong consumer secret", () => {
    expect(
      verifyTwitterSignature(BODY, twitterSign(BODY, SECRET), "other-secret"),
    ).toBe(false);
  });

  it("returns false when the sha256= prefix is missing", () => {
    const raw = createHmac("sha256", SECRET).update(BODY).digest("base64");
    expect(verifyTwitterSignature(BODY, raw, SECRET)).toBe(false);
  });

  it("returns false when signature or secret is missing", () => {
    expect(verifyTwitterSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyTwitterSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyTwitterSignature(BODY, twitterSign(BODY, SECRET), "")).toBe(
      false,
    );
  });
});

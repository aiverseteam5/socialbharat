import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";

const COOKIE_PREFIX = "oauth_pkce_";
const TTL_SECONDS = 600; // 10 minutes

/**
 * RFC 7636 base64url encoding (no padding, + -> -, / -> _).
 */
function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Generate a PKCE code_verifier (43-128 unreserved chars) and matching
 * S256 code_challenge = base64url(sha256(verifier)).
 */
export function generatePkcePair(): { verifier: string; challenge: string } {
  // 32 random bytes -> 43-char base64url string (within the 43-128 spec range)
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export async function storePkceVerifier(
  provider: string,
  verifier: string,
): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: `${COOKIE_PREFIX}${provider}`,
    value: verifier,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/**
 * Read and delete the stored verifier for this provider.
 * Returns null if no verifier is present (expired or never issued).
 */
export async function consumePkceVerifier(
  provider: string,
): Promise<string | null> {
  const jar = await cookies();
  const cookieName = `${COOKIE_PREFIX}${provider}`;
  const stored = jar.get(cookieName)?.value ?? null;
  jar.delete(cookieName);
  return stored;
}

import { cookies } from "next/headers";
import { randomBytes } from "crypto";

const COOKIE_PREFIX = "oauth_state_";
const TTL_SECONDS = 600; // 10 minutes

export async function issueState(provider: string): Promise<string> {
  const state = randomBytes(32).toString("hex");
  const jar = await cookies();
  jar.set({
    name: `${COOKIE_PREFIX}${provider}`,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return state;
}

export async function verifyState(
  provider: string,
  received: string | null,
): Promise<boolean> {
  if (!received) return false;
  const jar = await cookies();
  const cookieName = `${COOKIE_PREFIX}${provider}`;
  const stored = jar.get(cookieName)?.value;
  jar.delete(cookieName);
  if (!stored) return false;
  if (stored.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < stored.length; i++) {
    diff |= stored.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return diff === 0;
}

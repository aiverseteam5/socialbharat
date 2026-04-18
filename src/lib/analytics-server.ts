import { logger } from "./logger";

const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://app.posthog.com";

/**
 * Fire-and-forget server-side PostHog event capture.
 * Fails open (logs error, does not throw) so analytics never block the
 * critical path.
 */
export async function serverTrack(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: distinctId,
        event,
        properties: { ...properties, $lib: "socialbharat-server" },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    logger.error("PostHog server track failed", err, { event });
  }
}

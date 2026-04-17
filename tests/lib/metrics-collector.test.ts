import { describe, it, expect, vi, beforeEach } from "vitest";

const decryptMock = vi.fn((token: string) => `decrypted:${token}`);
const getMetricsMock = vi.fn();
const getPlatformConnectorMock = vi.fn();

vi.mock("@/lib/encryption", () => ({ decrypt: decryptMock }));

vi.mock("@/lib/platforms", () => ({
  getPlatformConnector: getPlatformConnectorMock,
}));

interface FakeProfile {
  id: string;
  org_id: string;
  platform: string;
  platform_user_id: string | null;
  access_token_encrypted: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
}

interface FakeQueryState {
  profiles: FakeProfile[];
  orgs: Array<{ id: string }>;
  upserts: Array<{ table: string; payload: Record<string, unknown> }>;
}

function createClientStub(state: FakeQueryState) {
  return {
    from(table: string) {
      if (table === "social_profiles") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: state.profiles, error: null }),
            }),
          }),
        };
      }
      if (table === "organizations") {
        return {
          select: async () => ({ data: state.orgs, error: null }),
        };
      }
      if (table === "profile_metrics") {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            state.upserts.push({ table, payload });
            return { data: null, error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

const serviceClientState: FakeQueryState = {
  profiles: [],
  orgs: [],
  upserts: [],
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createClientStub(serviceClientState),
}));

const loadCollector = async () => await import("@/lib/metrics-collector");

describe("metrics-collector", () => {
  beforeEach(() => {
    vi.resetModules();
    serviceClientState.profiles = [];
    serviceClientState.orgs = [];
    serviceClientState.upserts = [];
    decryptMock.mockClear();
    getMetricsMock.mockReset();
    getPlatformConnectorMock.mockReset();
    getPlatformConnectorMock.mockImplementation(() => ({
      getMetrics: getMetricsMock,
    }));
  });

  it("skips profiles without encrypted tokens", async () => {
    serviceClientState.profiles = [
      {
        id: "p1",
        org_id: "org1",
        platform: "facebook",
        platform_user_id: "fb1",
        access_token_encrypted: null,
        metadata: {},
        is_active: true,
      },
    ];
    const { collectAllMetrics } = await loadCollector();

    const result = await collectAllMetrics("org1", new Date("2026-04-17"));

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(getPlatformConnectorMock).not.toHaveBeenCalled();
    expect(serviceClientState.upserts).toHaveLength(0);
  });

  it("skips unsupported platforms", async () => {
    serviceClientState.profiles = [
      {
        id: "p1",
        org_id: "org1",
        platform: "sharechat",
        platform_user_id: "sc1",
        access_token_encrypted: "enc-token",
        metadata: {},
        is_active: true,
      },
    ];
    const { collectAllMetrics } = await loadCollector();

    const result = await collectAllMetrics("org1");

    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(getPlatformConnectorMock).not.toHaveBeenCalled();
  });

  it("upserts metrics from platform connector with computed engagement rate", async () => {
    serviceClientState.profiles = [
      {
        id: "profile-1",
        org_id: "org1",
        platform: "facebook",
        platform_user_id: "fb-page-1",
        access_token_encrypted: "enc-token",
        metadata: {},
        is_active: true,
      },
    ];
    getMetricsMock.mockResolvedValue({
      followers: 1000,
      engagement: 150,
      reach: 5000,
      impressions: 8000,
    });

    const { collectAllMetrics } = await loadCollector();
    const result = await collectAllMetrics("org1", new Date("2026-04-17"));

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(decryptMock).toHaveBeenCalledWith("enc-token");
    expect(getPlatformConnectorMock).toHaveBeenCalledWith(
      "facebook",
      expect.objectContaining({
        accessToken: "decrypted:enc-token",
        platformUserId: "fb-page-1",
      }),
    );
    expect(serviceClientState.upserts).toHaveLength(1);
    const upsert = serviceClientState.upserts[0];
    expect(upsert).toBeDefined();
    const payload = upsert!.payload;
    expect(payload.social_profile_id).toBe("profile-1");
    expect(payload.metric_date).toBe("2026-04-17");
    expect(payload.followers_count).toBe(1000);
    expect(payload.engagements).toBe(150);
    expect(payload.reach).toBe(5000);
    expect(payload.impressions).toBe(8000);
    // engagement rate = 150/1000 * 100 = 15
    expect(payload.engagement_rate).toBe(15);
  });

  it("counts a platform error as failed without throwing", async () => {
    serviceClientState.profiles = [
      {
        id: "p1",
        org_id: "org1",
        platform: "facebook",
        platform_user_id: "fb1",
        access_token_encrypted: "enc-token",
        metadata: {},
        is_active: true,
      },
    ];
    getMetricsMock.mockRejectedValue(new Error("Rate limited"));

    const { collectAllMetrics } = await loadCollector();
    const result = await collectAllMetrics("org1");

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(serviceClientState.upserts).toHaveLength(0);
  });

  it("iterates every organization in collectMetricsForAllOrgs", async () => {
    serviceClientState.orgs = [{ id: "org1" }, { id: "org2" }];
    serviceClientState.profiles = [
      {
        id: "p1",
        org_id: "org1",
        platform: "facebook",
        platform_user_id: "fb1",
        access_token_encrypted: "enc",
        metadata: {},
        is_active: true,
      },
    ];
    getMetricsMock.mockResolvedValue({
      followers: 100,
      engagement: 10,
      reach: 200,
      impressions: 300,
    });

    const { collectMetricsForAllOrgs } = await loadCollector();
    const result = await collectMetricsForAllOrgs(new Date("2026-04-17"));

    // Both orgs return the same stub profile set, so we expect 2 upserts.
    expect(result.processed).toBe(2);
    expect(serviceClientState.upserts).toHaveLength(2);
  });
});

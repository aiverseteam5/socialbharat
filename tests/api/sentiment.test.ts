import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    __mockCreate: mockCreate,
  };
});

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function getOpenAIMockCreate() {
  const mod = await import("openai");
  return (mod as unknown as { __mockCreate: ReturnType<typeof vi.fn> })
    .__mockCreate;
}

function buildAuthenticatedSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
  };
}

function makeOpenAIResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

describe("POST /api/ai/sentiment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("returns positive sentiment for positive English text", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildAuthenticatedSupabaseMock() as never,
    );

    const mockCreate = await getOpenAIMockCreate();
    mockCreate.mockResolvedValue(
      makeOpenAIResponse(
        JSON.stringify({
          score: 0.85,
          label: "positive",
          language_detected: "en",
        }),
      ),
    );

    const { POST } = await import("@/app/api/ai/sentiment/route");
    const req = new Request("http://localhost/api/ai/sentiment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "This product is amazing! I love it so much.",
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      score: number;
      label: string;
      language_detected: string;
    };
    expect(body.label).toBe("positive");
    expect(body.score).toBeGreaterThan(0);
    expect(body.language_detected).toBe("en");
  });

  it("returns negative sentiment for negative Hindi text", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildAuthenticatedSupabaseMock() as never,
    );

    const mockCreate = await getOpenAIMockCreate();
    mockCreate.mockResolvedValue(
      makeOpenAIResponse(
        JSON.stringify({
          score: -0.9,
          label: "negative",
          language_detected: "hi",
        }),
      ),
    );

    const { POST } = await import("@/app/api/ai/sentiment/route");
    const req = new Request("http://localhost/api/ai/sentiment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "यह सेवा बहुत खराब है, मुझे बहुत निराशा हुई।",
        language: "hi",
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      score: number;
      label: string;
      language_detected: string;
    };
    expect(body.label).toBe("negative");
    expect(body.score).toBeLessThan(0);
    expect(body.language_detected).toBe("hi");
  });

  it("returns mixed sentiment for Hinglish text with both positive and negative elements", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildAuthenticatedSupabaseMock() as never,
    );

    const mockCreate = await getOpenAIMockCreate();
    mockCreate.mockResolvedValue(
      makeOpenAIResponse(
        JSON.stringify({
          score: -0.1,
          label: "mixed",
          language_detected: "hi",
        }),
      ),
    );

    const { POST } = await import("@/app/api/ai/sentiment/route");
    const req = new Request("http://localhost/api/ai/sentiment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Product toh accha hai yaar, but delivery bahut slow thi. Disappointed!",
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { label: string };
    expect(body.label).toBe("mixed");
  });

  it("returns 401 when user is not authenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);

    const { POST } = await import("@/app/api/ai/sentiment/route");
    const req = new Request("http://localhost/api/ai/sentiment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "test" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid request body (empty text)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildAuthenticatedSupabaseMock() as never,
    );

    const { POST } = await import("@/app/api/ai/sentiment/route");
    const req = new Request("http://localhost/api/ai/sentiment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("clamps sentiment score to [-1, 1] range", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      buildAuthenticatedSupabaseMock() as never,
    );

    const mockCreate = await getOpenAIMockCreate();
    mockCreate.mockResolvedValue(
      makeOpenAIResponse(
        JSON.stringify({
          score: 5.0,
          label: "positive",
          language_detected: "en",
        }),
      ),
    );

    const { POST } = await import("@/app/api/ai/sentiment/route");
    const req = new Request("http://localhost/api/ai/sentiment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Great product!" }),
    });

    const res = await POST(req as never);
    const body = (await res.json()) as { score: number };
    expect(body.score).toBeLessThanOrEqual(1);
    expect(body.score).toBeGreaterThanOrEqual(-1);
  });
});

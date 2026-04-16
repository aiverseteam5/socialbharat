import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger } from "@/lib/logger";

// Helper with a single call signature so ReturnType<> picks an unambiguous type.
// vi.spyOn is overloaded (method / getter / setter variants), which breaks
// direct `ReturnType<typeof vi.spyOn<T, K>>` usage.
function spyOnWrite(stream: NodeJS.WriteStream) {
  return vi.spyOn(stream, "write").mockImplementation(() => true);
}

describe("logger", () => {
  const originalEnv = process.env.LOG_IN_TESTS;
  let stdoutSpy: ReturnType<typeof spyOnWrite>;
  let stderrSpy: ReturnType<typeof spyOnWrite>;

  beforeEach(() => {
    process.env.LOG_IN_TESTS = "1";
    stdoutSpy = spyOnWrite(process.stdout);
    stderrSpy = spyOnWrite(process.stderr);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    if (originalEnv === undefined) delete process.env.LOG_IN_TESTS;
    else process.env.LOG_IN_TESTS = originalEnv;
  });

  it("suppresses output when NODE_ENV=test and LOG_IN_TESTS is not set", () => {
    delete process.env.LOG_IN_TESTS;
    logger.info("should be suppressed");
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("info and debug write a single JSON line to stdout", () => {
    logger.info("hello", { userId: "u1" });
    logger.debug("dbg");
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    const firstLine = stdoutSpy.mock.calls[0]![0] as string;
    expect(firstLine.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(firstLine.trimEnd());
    expect(parsed).toMatchObject({
      level: "info",
      message: "hello",
      userId: "u1",
    });
    expect(typeof parsed.ts).toBe("string");
  });

  it("warn writes JSON to stderr with level=warn", () => {
    logger.warn("careful", { code: 42 });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(
      (stderrSpy.mock.calls[0]![0] as string).trimEnd(),
    );
    expect(parsed).toMatchObject({
      level: "warn",
      message: "careful",
      code: 42,
    });
  });

  it("error serialises Error instances with name/message/stack", () => {
    const boom = new Error("kaboom");
    logger.error("explosion", boom, { opId: "x" });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(
      (stderrSpy.mock.calls[0]![0] as string).trimEnd(),
    );
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("explosion");
    expect(parsed.opId).toBe("x");
    expect(parsed.error).toMatchObject({ name: "Error", message: "kaboom" });
    expect(typeof parsed.error.stack).toBe("string");
  });

  it("error wraps non-Error values under { value }", () => {
    logger.error("weird", "just a string");
    const parsed = JSON.parse(
      (stderrSpy.mock.calls[0]![0] as string).trimEnd(),
    );
    expect(parsed.error).toEqual({ value: "just a string" });
  });

  it("error omits error field when no err is passed", () => {
    logger.error("msg-only");
    const parsed = JSON.parse(
      (stderrSpy.mock.calls[0]![0] as string).trimEnd(),
    );
    expect(parsed.error).toBeUndefined();
  });
});

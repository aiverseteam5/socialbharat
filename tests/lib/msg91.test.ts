import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendOtp, verifyOtp } from "@/lib/msg91";

global.fetch = vi.fn();

// env.MSG91_AUTH_KEY is always 'test-msg91-key' (set in tests/setup.ts)
// env.MSG91_TEMPLATE_ID is undefined (optional, not set in setup)

describe("MSG91 Helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendOtp", () => {
    it("sends OTP via MSG91 API", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          type: "success",
          message: "OTP sent successfully",
        }),
      } as Response);

      const result = await sendOtp("+919876543210");

      expect(fetch).toHaveBeenCalledWith(
        "https://api.msg91.com/api/v5/otp/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authkey: "test-msg91-key",
          },
          body: JSON.stringify({
            template_id: undefined,
            mobile: "+919876543210",
            otp_length: 6,
          }),
        },
      );
      expect(result).toEqual({
        message: "OTP sent successfully",
        expiresIn: 300,
      });
    });

    it("throws when MSG91 API returns error", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ type: "error", message: "Invalid phone number" }),
      } as Response);

      await expect(sendOtp("+919876543210")).rejects.toThrow(
        "Failed to send OTP. Please try again.",
      );
    });

    it("throws when fetch fails", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      await expect(sendOtp("+919876543210")).rejects.toThrow(
        "Failed to send OTP. Please try again.",
      );
    });
  });

  describe("verifyOtp", () => {
    it("verifies OTP via MSG91 API", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          type: "success",
          message: "OTP verified successfully",
        }),
      } as Response);

      const result = await verifyOtp("+919876543210", "123456");

      expect(fetch).toHaveBeenCalledWith(
        "https://api.msg91.com/api/v5/otp/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authkey: "test-msg91-key",
          },
          body: JSON.stringify({
            mobile: "+919876543210",
            otp: "123456",
          }),
        },
      );
      expect(result).toEqual({
        valid: true,
        message: "OTP verified successfully",
      });
    });

    it("returns invalid when MSG91 API returns error", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ type: "error", message: "Invalid OTP" }),
      } as Response);

      const result = await verifyOtp("+919876543210", "000000");

      expect(result).toEqual({ valid: false, message: "Invalid OTP" });
    });

    it("returns failure when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      const result = await verifyOtp("+919876543210", "123456");

      expect(result).toEqual({
        valid: false,
        message: "Failed to verify OTP. Please try again.",
      });
    });
  });
});

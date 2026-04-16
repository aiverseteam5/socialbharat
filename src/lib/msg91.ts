// MSG91 OTP helper
// Send and verify OTP via MSG91 REST API

import { logger } from "./logger";

interface SendOtpResponse {
  type: string;
  message: string;
}

interface VerifyOtpResponse {
  type: string;
  message: string;
  details?: {
    otp?: string;
  };
}

const MOCK_OTP = "123456";

/**
 * Send OTP to a phone number via MSG91
 * @param phone - Phone number in format +91XXXXXXXXXX
 * @returns Promise with success/failure message
 */
export async function sendOtp(
  phone: string,
): Promise<{ message: string; expiresIn: number }> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  // If MSG91 auth key is not set, use mock OTP for development
  if (!authKey) {
    logger.warn("MSG91_AUTH_KEY not set; using mock OTP for development", {
      mockOtp: MOCK_OTP,
    });
    return {
      message: "OTP sent (development mode)",
      expiresIn: 300,
    };
  }

  try {
    const response = await fetch("https://api.msg91.com/api/v5/otp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: phone,
        otp_length: 6,
      }),
    });

    const data: SendOtpResponse = await response.json();

    if (data.type === "success") {
      return {
        message: data.message || "OTP sent successfully",
        expiresIn: 300,
      };
    } else {
      throw new Error(data.message || "Failed to send OTP");
    }
  } catch (error) {
    logger.error("MSG91 sendOtp failed", error, { phone });
    throw new Error("Failed to send OTP. Please try again.");
  }
}

/**
 * Verify OTP for a phone number via MSG91
 * @param phone - Phone number in format +91XXXXXXXXXX
 * @param otp - 6-digit OTP code
 * @returns Promise with verification result
 */
export async function verifyOtp(
  phone: string,
  otp: string,
): Promise<{ valid: boolean; message: string }> {
  const authKey = process.env.MSG91_AUTH_KEY;

  // If MSG91 auth key is not set, use mock OTP for development
  if (!authKey) {
    logger.warn("MSG91_AUTH_KEY not set; using mock OTP verification");
    if (otp === MOCK_OTP) {
      return {
        valid: true,
        message: "OTP verified successfully (development mode)",
      };
    } else {
      return {
        valid: false,
        message: "Invalid OTP",
      };
    }
  }

  try {
    const response = await fetch("https://api.msg91.com/api/v5/otp/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        mobile: phone,
        otp,
      }),
    });

    const data: VerifyOtpResponse = await response.json();

    if (data.type === "success") {
      return {
        valid: true,
        message: data.message || "OTP verified successfully",
      };
    } else {
      return {
        valid: false,
        message: data.message || "Invalid OTP",
      };
    }
  } catch (error) {
    logger.error("MSG91 verifyOtp failed", error, { phone });
    return {
      valid: false,
      message: "Failed to verify OTP. Please try again.",
    };
  }
}

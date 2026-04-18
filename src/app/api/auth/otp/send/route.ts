import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/msg91";
import { sendOtpSchema } from "@/types/schemas";
import { checkOtpSendRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = sendOtpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid phone number",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { phone } = validationResult.data;

    const rl = await checkOtpSendRateLimit(phone);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please try again later." },
        { status: 429 },
      );
    }

    // Send OTP via MSG91
    const result = await sendOtp(phone);

    return NextResponse.json({
      message: result.message,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    logger.error("POST /api/auth/otp/send failed", error);
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 },
    );
  }
}

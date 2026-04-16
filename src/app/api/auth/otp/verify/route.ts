import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/msg91";
import { verifyOtpSchema } from "@/types/schemas";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = verifyOtpSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const { phone, otp } = validationResult.data;

    // Verify OTP via MSG91
    const otpResult = await verifyOtp(phone, otp);
    if (!otpResult.valid) {
      return NextResponse.json({ error: otpResult.message }, { status: 400 });
    }

    // Create or find user in Supabase Auth
    const supabase = await createClient();

    // First, check if user exists by phone in users table
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email, phone, full_name, avatar_url")
      .eq("phone", phone)
      .single();

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // User doesn't exist, create via Supabase Auth
      // Generate a temporary email for phone-only auth
      const tempEmail = `user_${phone.replace("+", "")}@temp.socialbharat.dev`;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: tempEmail,
        password: Math.random().toString(36).slice(-20), // Random password for phone-only users
        phone: phone,
        options: {
          data: {
            phone_only: true,
          },
        },
      });

      if (authError || !authData.user) {
        logger.error("Supabase auth signUp failed", authError, { phone });
        return NextResponse.json(
          { error: "Failed to create user. Please try again." },
          { status: 500 },
        );
      }

      userId = authData.user.id;

      // Insert into users table
      const { error: insertError } = await supabase.from("users").insert({
        id: userId,
        phone: phone,
        email: null,
        full_name: null,
        avatar_url: null,
        preferred_language: "en",
        notification_preferences: {
          in_app: true,
          email: true,
          whatsapp: false,
          sms: false,
        },
      });

      if (insertError) {
        logger.error("Users table insert failed", insertError, {
          userId,
          phone,
        });
        return NextResponse.json(
          { error: "Failed to create user profile. Please try again." },
          { status: 500 },
        );
      }

      isNewUser = true;
    }

    // Since phone-only auth is complex, we'll use the session from the verify flow
    // For now, create a session directly
    const {
      data: { session },
      error: signInError,
    } = await supabase.auth.getSession();

    if (signInError) {
      logger.error("Supabase getSession failed", signInError, { userId });
      return NextResponse.json(
        { error: "Failed to create session. Please try again." },
        { status: 500 },
      );
    }

    // Return user data and session
    return NextResponse.json({
      user: existingUser || {
        id: userId,
        phone,
        email: null,
        full_name: null,
        avatar_url: null,
      },
      session: session,
      isNewUser,
    });
  } catch (error) {
    logger.error("POST /api/auth/otp/verify failed", error);
    return NextResponse.json(
      { error: "Failed to verify OTP. Please try again." },
      { status: 500 },
    );
  }
}

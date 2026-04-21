import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serverTrack } from "@/lib/analytics-server";
import { logger } from "@/lib/logger";

const bodySchema = z
  .object({
    full_name: z.string().min(2, "Name must be at least 2 characters").max(255),
    email: z
      .string()
      .email("Invalid email address")
      .optional()
      .or(z.literal("")),
    password: z.string().optional().or(z.literal("")),
    phone: z
      .string()
      .regex(/^\+91[6-9]\d{9}$/, "Invalid Indian phone number")
      .optional(),
    account_type: z.enum(["individual", "team"]).default("individual"),
  })
  .refine((d) => d.phone || (d.email && d.password && d.password.length >= 8), {
    message:
      "Provide phone (after OTP verify) or email + password (min 8 chars)",
  });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { full_name, phone, account_type } = parsed.data;
    const email =
      parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null;
    const password =
      parsed.data.password && parsed.data.password !== ""
        ? parsed.data.password
        : null;

    const supabase = await createClient();

    if (phone) {
      const { data: existing, error: findErr } = await supabase
        .from("users")
        .select("id")
        .eq("phone", phone)
        .single();

      if (findErr || !existing) {
        logger.error("Register (phone): user not found after OTP", findErr, {
          phone,
        });
        return NextResponse.json(
          { error: "Verify OTP first, then complete registration." },
          { status: 400 },
        );
      }

      const { error: updateErr } = await supabase
        .from("users")
        .update({ full_name, email, account_type })
        .eq("id", existing.id);

      if (updateErr) {
        logger.error("Register (phone): profile update failed", updateErr, {
          userId: existing.id,
        });
        return NextResponse.json(
          { error: "Failed to save profile. Please try again." },
          { status: 500 },
        );
      }

      void serverTrack(existing.id, "registration_completed", {
        auth_method: "otp",
      });

      return NextResponse.json({ userId: existing.id });
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const svc = createServiceClient();
    const { data: authData, error: signUpErr } =
      await svc.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, account_type },
      });

    if (signUpErr || !authData.user) {
      logger.error("Register (email): admin.createUser failed", signUpErr, {
        email,
      });
      return NextResponse.json(
        { error: signUpErr?.message || "Failed to create account." },
        { status: 400 },
      );
    }

    const userId = authData.user.id;

    // Upsert — a DB trigger may have already created the row when auth.users
    // was inserted by admin.createUser. Use upsert to avoid a 409 conflict.
    const { error: insertErr } = await svc.from("users").upsert(
      {
        id: userId,
        email,
        phone: null,
        full_name,
        account_type,
        avatar_url: null,
        preferred_language: "en",
        notification_preferences: {
          in_app: true,
          email: true,
          whatsapp: false,
          sms: false,
        },
      },
      { onConflict: "id" },
    );

    if (insertErr) {
      logger.error("Register (email): users upsert failed", insertErr, {
        userId,
      });
      return NextResponse.json(
        { error: "Failed to create user profile." },
        { status: 500 },
      );
    }

    void serverTrack(userId, "registration_completed", {
      auth_method: "email",
    });

    return NextResponse.json({ userId });
  } catch (error) {
    logger.error("POST /api/auth/register failed", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}

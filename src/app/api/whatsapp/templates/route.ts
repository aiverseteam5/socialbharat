import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  countTemplateVariables,
  createWhatsappTemplateSchema,
} from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * GET /api/whatsapp/templates
 * Lists Meta-approved templates for the caller's org. RLS scopes by org_id.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ templates: data ?? [] });
  } catch (error) {
    logger.error("GET /api/whatsapp/templates failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load templates",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/whatsapp/templates
 * Manual template registry — operator types in what Meta already approved in
 * Business Manager. variable_count is derived from {{N}} placeholders in body
 * so the broadcast worker can validate template_variables coverage later.
 * Duplicate (org_id, name, language) returns 409.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createWhatsappTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!orgMember) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 },
      );
    }

    const variable_count = countTemplateVariables(parsed.data.body);

    const { data, error } = await supabase
      .from("whatsapp_templates")
      .insert({
        org_id: orgMember.org_id,
        name: parsed.data.name,
        language: parsed.data.language,
        category: parsed.data.category,
        body: parsed.data.body,
        variable_count,
        status: parsed.data.status,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A template with this name and language already exists" },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    logger.error("POST /api/whatsapp/templates failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create template",
      },
      { status: 500 },
    );
  }
}

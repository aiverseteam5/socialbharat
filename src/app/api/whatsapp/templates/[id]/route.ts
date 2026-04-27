import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  countTemplateVariables,
  updateWhatsappTemplateSchema,
} from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * PATCH /api/whatsapp/templates/[id]
 * Update a template. If body changes, variable_count is re-derived so it
 * stays consistent with the {{N}} placeholders the worker will substitute.
 * Duplicate (org_id, name, language) returns 409.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await request.json();
    const parsed = updateWhatsappTemplateSchema.safeParse(requestBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.language !== undefined)
      patch.language = parsed.data.language;
    if (parsed.data.category !== undefined)
      patch.category = parsed.data.category;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.body !== undefined) {
      patch.body = parsed.data.body;
      patch.variable_count = countTemplateVariables(parsed.data.body);
    }

    const { data, error } = await supabase
      .from("whatsapp_templates")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A template with this name and language already exists" },
          { status: 409 },
        );
      }
      throw error;
    }
    if (!data) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ template: data });
  } catch (error) {
    logger.error("PATCH /api/whatsapp/templates/[id] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update template",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/whatsapp/templates/[id]
 * Hard delete. The whatsapp_campaigns FK uses ON DELETE RESTRICT — deleting a
 * template that has campaigns referencing it will surface as 409 so the
 * operator can remove or reassign those campaigns first.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("whatsapp_templates")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          {
            error:
              "Cannot delete: this template is used by one or more campaigns",
          },
          { status: 409 },
        );
      }
      throw error;
    }
    if (!data) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("DELETE /api/whatsapp/templates/[id] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete template",
      },
      { status: 500 },
    );
  }
}

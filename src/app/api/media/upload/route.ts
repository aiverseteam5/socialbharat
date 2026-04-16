import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { uploadMediaSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * POST /api/media/upload
 * Upload a file to Supabase Storage and create media asset record
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

    const formData = await request.formData();
    const validationResult = uploadMediaSchema.safeParse({
      file: formData.get("file"),
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid upload", details: validationResult.error.errors },
        { status: 400 },
      );
    }

    const { file } = validationResult.data;

    // Get user's organization
    const { data: orgMember } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      );
    }

    const orgId = orgMember.org_id;

    // Upload to Supabase Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${orgId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(fileName);

    // Create media asset record
    const { data: mediaAsset, error: dbError } = await supabase
      .from("media_assets")
      .insert({
        org_id: orgId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: fileName,
        cdn_url: publicUrl,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ mediaAsset }, { status: 201 });
  } catch (error) {
    logger.error("POST /api/media/upload failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 },
    );
  }
}

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { uploadMediaSchema } from "@/types/schemas";
import { logger } from "@/lib/logger";

/**
 * POST /api/media/upload
 * Upload a file to Supabase Storage and create a media asset record.
 *
 * Returns the permanent public URL (not a signed URL) so platform APIs
 * (Instagram container, Facebook photos) can fetch the media directly.
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

    const fileExt = file.name.split(".").pop();
    const fileName = `${orgId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(fileName);

    // For images, derive a thumbnail URL using Supabase's on-demand image
    // transformation. If image transformations are disabled on the project,
    // the URL simply falls back to serving the original.
    const isImage = file.type.startsWith("image/");
    const thumbnailUrl = isImage
      ? supabase.storage.from("media").getPublicUrl(fileName, {
          transform: { width: 400, height: 400, resize: "cover" },
        }).data.publicUrl
      : null;

    const { data: mediaAsset, error: dbError } = await supabase
      .from("media_assets")
      .insert({
        org_id: orgId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: fileName,
        cdn_url: publicUrl,
        thumbnail_url: thumbnailUrl,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return NextResponse.json({ mediaAsset, publicUrl }, { status: 201 });
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

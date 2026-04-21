import { NextResponse } from "next/server";
import { getUpcomingFestivals } from "@/lib/festivals";

/**
 * GET /api/festivals/upcoming
 * Returns festivals in the next 30 days.
 */
export async function GET() {
  try {
    const festivals = await getUpcomingFestivals(30);
    return NextResponse.json({ festivals });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch upcoming festivals",
      },
      { status: 500 },
    );
  }
}

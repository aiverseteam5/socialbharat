import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUpcomingFestivals, getFestivalsByDateRange } from "@/lib/festivals";

const querySchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.coerce.number().int().min(1).max(365).default(14),
  region: z.string().optional(),
});

/**
 * GET /api/festivals
 * List festivals. Supports either start_date+end_date or days (days-ahead from today).
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query params" },
        { status: 400 },
      );
    }

    const { start_date, end_date, days, region } = parsed.data;

    let festivals;
    if (start_date && end_date) {
      festivals = await getFestivalsByDateRange(start_date, end_date);
    } else {
      festivals = await getUpcomingFestivals(days, region);
    }

    return NextResponse.json({ festivals });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch festivals",
      },
      { status: 500 },
    );
  }
}

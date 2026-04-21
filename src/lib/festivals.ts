import { createClient } from "./supabase/server";
import { logger } from "./logger";
import type { IndianFestival } from "@/types/database";

export type { IndianFestival };

/**
 * Get upcoming festivals within N days from today.
 */
export async function getUpcomingFestivals(
  days = 14,
  region?: string,
): Promise<IndianFestival[]> {
  const supabase = await createClient();

  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + days);

  let query = supabase
    .from("indian_festivals")
    .select("*")
    .gte("festival_date", now.toISOString().split("T")[0])
    .lte("festival_date", future.toISOString().split("T")[0])
    .order("festival_date", { ascending: true });

  if (region && region !== "ALL") {
    query = query.contains("regions", [region]);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("Error fetching upcoming festivals", error, { days, region });
    return [];
  }

  return (data ?? []) as IndianFestival[];
}

/**
 * Get festivals within a specific date range (YYYY-MM-DD, inclusive).
 */
export async function getFestivalsByDateRange(
  startDate: string,
  endDate: string,
): Promise<IndianFestival[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("indian_festivals")
    .select("*")
    .gte("festival_date", startDate)
    .lte("festival_date", endDate)
    .order("festival_date", { ascending: true });

  if (error) {
    logger.error("Error fetching festivals by date range", error, {
      startDate,
      endDate,
    });
    return [];
  }

  return (data ?? []) as IndianFestival[];
}

/**
 * Get festival by ID.
 */
export async function getFestivalById(
  festivalId: string,
): Promise<IndianFestival | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("indian_festivals")
    .select("*")
    .eq("id", festivalId)
    .single();

  if (error) {
    logger.error("Error fetching festival by id", error, { festivalId });
    return null;
  }

  return data as IndianFestival | null;
}

/**
 * Get all festivals for a specific date (YYYY-MM-DD).
 */
export async function getFestivalsByDate(
  date: string,
): Promise<IndianFestival[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("indian_festivals")
    .select("*")
    .eq("festival_date", date)
    .order("name", { ascending: true });

  if (error) {
    logger.error("Error fetching festivals by date", error, { date });
    return [];
  }

  return (data ?? []) as IndianFestival[];
}

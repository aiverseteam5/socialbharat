import { createClient } from './supabase/server'

export interface IndianFestival {
  id: string
  name: string
  name_hindi: string | null
  date: string
  region: string | null
  hashtags: string[]
  description: string | null
}

/**
 * Get upcoming Indian festivals within N days
 * @param days - Number of days to look ahead (default: 14)
 * @param region - Optional region filter
 * @returns Array of upcoming festivals
 */
export async function getUpcomingFestivals(days: number = 14, region?: string): Promise<IndianFestival[]> {
  const supabase = await createClient()
  
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(now.getDate() + days)
  
  let query = supabase
    .from('indian_festivals')
    .select('*')
    .gte('date', now.toISOString().split('T')[0])
    .lte('date', futureDate.toISOString().split('T')[0])
    .order('date', { ascending: true })
  
  if (region) {
    query = query.eq('region', region)
  }
  
  const { data: festivals, error } = await query
  
  if (error) {
    console.error('Error fetching festivals:', error)
    return []
  }
  
  return (festivals || []) as IndianFestival[]
}

/**
 * Get festival by ID
 * @param festivalId - The festival ID
 * @returns Festival details or null
 */
export async function getFestivalById(festivalId: string): Promise<IndianFestival | null> {
  const supabase = await createClient()
  
  const { data: festival, error } = await supabase
    .from('indian_festivals')
    .select('*')
    .eq('id', festivalId)
    .single()
  
  if (error) {
    console.error('Error fetching festival:', error)
    return null
  }
  
  return festival as IndianFestival | null
}

/**
 * Get all festivals for a specific date
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of festivals for the date
 */
export async function getFestivalsByDate(date: string): Promise<IndianFestival[]> {
  const supabase = await createClient()
  
  const { data: festivals, error } = await supabase
    .from('indian_festivals')
    .select('*')
    .eq('date', date)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching festivals by date:', error)
    return []
  }
  
  return (festivals || []) as IndianFestival[]
}

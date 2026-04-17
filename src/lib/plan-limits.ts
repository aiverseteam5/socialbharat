import { createClient } from '@/lib/supabase/server'

/**
 * Plan limits middleware/helper
 * Checks if current org's plan allows a feature
 */

export interface PlanLimits {
  maxSocialProfiles: number
  maxUsers: number
  maxPostsPerMonth: number | null
  maxScheduledPosts: number | null
  aiContentGeneration: boolean
  socialListening: boolean
  customReports: boolean
  approvalWorkflows: boolean
  whatsappInbox: boolean
  apiAccess: boolean
}

export type Feature =
  | 'ai_content_generation'
  | 'social_listening'
  | 'custom_reports'
  | 'approval_workflows'
  | 'whatsapp_inbox'
  | 'api_access'

export type NumericLimit =
  | 'max_social_profiles'
  | 'max_users'
  | 'max_posts_per_month'
  | 'max_scheduled_posts'

/**
 * Get plan limits for an organization
 */
export async function getPlanLimits(orgId: string): Promise<PlanLimits | null> {
  const supabase = await createClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('plan, plan_expires_at')
    .eq('id', orgId)
    .single()

  if (!org) {
    return null
  }

  // Check if plan is expired
  if (org.plan_expires_at && new Date(org.plan_expires_at) < new Date()) {
    // Downgrade to free plan if expired
    await supabase
      .from('organizations')
      .update({ plan: 'free', plan_expires_at: null })
      .eq('id', orgId)
    org.plan = 'free'
  }

  const { data: planLimits } = await supabase
    .from('plan_limits')
    .select('*')
    .eq('plan', org.plan)
    .single()

  if (!planLimits) {
    return null
  }

  return {
    maxSocialProfiles: planLimits.max_social_profiles,
    maxUsers: planLimits.max_users,
    maxPostsPerMonth: planLimits.max_posts_per_month,
    maxScheduledPosts: planLimits.max_scheduled_posts,
    aiContentGeneration: planLimits.ai_content_generation,
    socialListening: planLimits.social_listening,
    customReports: planLimits.custom_reports,
    approvalWorkflows: planLimits.approval_workflows,
    whatsappInbox: planLimits.whatsapp_inbox,
    apiAccess: planLimits.api_access,
  }
}

/**
 * Check if org's plan allows a specific feature
 */
export async function checkPlanLimit(orgId: string, feature: Feature): Promise<boolean> {
  const limits = await getPlanLimits(orgId)
  if (!limits) {
    return false
  }

  switch (feature) {
    case 'ai_content_generation':
      return limits.aiContentGeneration
    case 'social_listening':
      return limits.socialListening
    case 'custom_reports':
      return limits.customReports
    case 'approval_workflows':
      return limits.approvalWorkflows
    case 'whatsapp_inbox':
      return limits.whatsappInbox
    case 'api_access':
      return limits.apiAccess
    default:
      return false
  }
}

/**
 * Check numeric limit usage
 * Returns { allowed: boolean, current: number, max: number | null }
 */
export async function checkNumericLimit(
  orgId: string,
  limit: NumericLimit
): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const limits = await getPlanLimits(orgId)
  if (!limits) {
    return { allowed: false, current: 0, max: 0 }
  }

  const supabase = await createClient()
  let current = 0
  let max: number | null = 0

  switch (limit) {
    case 'max_social_profiles':
      max = limits.maxSocialProfiles === -1 ? null : limits.maxSocialProfiles
      const { count: profileCount } = await supabase
        .from('social_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
      current = profileCount || 0
      break

    case 'max_users':
      max = limits.maxUsers === -1 ? null : limits.maxUsers
      const { count: userCount } = await supabase
        .from('org_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
      current = userCount || 0
      break

    case 'max_posts_per_month':
      max = limits.maxPostsPerMonth === -1 ? null : limits.maxPostsPerMonth
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const { count: postCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', startOfMonth.toISOString())
      current = postCount || 0
      break

    case 'max_scheduled_posts':
      max = limits.maxScheduledPosts === -1 ? null : limits.maxScheduledPosts
      const { count: scheduledCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'scheduled')
      current = scheduledCount || 0
      break
  }

  const allowed = max === null || current < max

  return { allowed, current, max }
}

/**
 * Check if org can add a social profile
 */
export async function canAddSocialProfile(orgId: string): Promise<boolean> {
  const result = await checkNumericLimit(orgId, 'max_social_profiles')
  return result.allowed
}

/**
 * Check if org can add a user
 */
export async function canAddUser(orgId: string): Promise<boolean> {
  const result = await checkNumericLimit(orgId, 'max_users')
  return result.allowed
}

/**
 * Check if org can create a post
 */
export async function canCreatePost(orgId: string): Promise<boolean> {
  const result = await checkNumericLimit(orgId, 'max_posts_per_month')
  return result.allowed
}

/**
 * Check if org can schedule a post
 */
export async function canSchedulePost(orgId: string): Promise<boolean> {
  const result = await checkNumericLimit(orgId, 'max_scheduled_posts')
  return result.allowed
}

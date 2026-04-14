// Server-side auth helpers
// All auth checks must happen server-side

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

/**
 * Get the current user from the session
 * @returns User object or null if not authenticated
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Get the current session
 * @returns Session object or null if not authenticated
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Require authentication - redirect to /login if not authenticated
 * @returns User object
 * @throws Redirects to /login if not authenticated
 */
export async function requireAuth(): Promise<User> {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

/**
 * Require a specific role for a user in an organization
 * @param orgId - Organization ID
 * @param allowedRoles - Array of allowed roles
 * @throws 403 if user doesn't have required role
 * @throws Redirects to /login if not authenticated
 */
export async function requireRole(
  orgId: string,
  allowedRoles: UserRole[]
): Promise<{ user: User; role: UserRole }> {
  const user = await requireAuth()
  
  const supabase = await createClient()
  const { data: member, error } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()
  
  if (error || !member) {
    throw new Error('You are not a member of this organization')
  }
  
  if (!allowedRoles.includes(member.role as UserRole)) {
    throw new Error('You do not have permission to perform this action')
  }
  
  return { user, role: member.role as UserRole }
}

/**
 * Get the current organization for a user
 * @returns Organization object or null if user has no org
 */
export async function getCurrentOrg(userId: string): Promise<unknown | null> {
  const supabase = await createClient()
  
  const { data: member, error } = await supabase
    .from('org_members')
    .select(`
      org_id,
      role,
      organizations (
        id,
        name,
        slug,
        logo_url,
        plan
      )
    `)
    .eq('user_id', userId)
    .limit(1)
    .single()
  
  if (error || !member) {
    return null
  }
  
  return member
}

/**
 * Check if user has a specific role in an organization
 * @param orgId - Organization ID
 * @param role - Role to check
 * @returns boolean
 */
export async function hasRole(orgId: string, role: UserRole): Promise<boolean> {
  const user = await getUser()
  if (!user) return false
  
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()
  
  return member?.role === role
}

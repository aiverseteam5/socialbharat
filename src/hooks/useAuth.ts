'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import type { User, Session } from '@supabase/supabase-js'

interface UseAuthProps {
  user: User | null
  session: Session | null
  currentOrg: unknown | null
  role: string | null
}

export function useAuth({ user, session, currentOrg, role }: UseAuthProps) {
  const setUser = useAuthStore((state) => state.setUser)
  const setSession = useAuthStore((state) => state.setSession)
  const setCurrentOrg = useAuthStore((state) => state.setCurrentOrg)
  const setRole = useAuthStore((state) => state.setRole)
  const setLoading = useAuthStore((state) => state.setLoading)

  useEffect(() => {
    setUser(user)
    setSession(session)
    setCurrentOrg(currentOrg)
    setRole(role as 'owner' | 'admin' | 'editor' | 'viewer' | null)
    setLoading(false)
  }, [user, session, currentOrg, role, setUser, setSession, setCurrentOrg, setRole, setLoading])

  return useAuthStore()
}

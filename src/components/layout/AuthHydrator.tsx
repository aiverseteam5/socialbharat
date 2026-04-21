"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import type { User, Session } from "@supabase/supabase-js";
import type { UserRole } from "@/stores/auth-store";

interface Props {
  user: User;
  session: Session | null;
  currentOrg: { id: string; name: string; slug: string; plan: string } | null;
  role: UserRole | null;
}

export function AuthHydrator({ user, session, currentOrg, role }: Props) {
  const { setUser, setSession, setCurrentOrg, setRole } = useAuthStore();

  useEffect(() => {
    setUser(user);
    setSession(session);
    setCurrentOrg(currentOrg);
    setRole(role ?? null);
  }, [
    user,
    session,
    currentOrg,
    role,
    setUser,
    setSession,
    setCurrentOrg,
    setRole,
  ]);

  return null;
}

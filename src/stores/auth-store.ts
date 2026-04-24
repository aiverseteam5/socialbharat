import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "owner" | "admin" | "editor" | "viewer";

interface AuthState {
  user: User | null;
  session: Session | null;
  currentOrg: unknown | null;
  role: UserRole | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setCurrentOrg: (org: unknown | null) => void;
  setRole: (role: UserRole | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  currentOrg: null,
  role: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setCurrentOrg: (org) => set({ currentOrg: org }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ isLoading: loading }),
  signOut: async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    // `global` scope revokes all refresh tokens for the user across devices —
    // safer than the default `local`, which only clears the current session.
    await supabase.auth.signOut({ scope: "global" });
    set({ user: null, session: null, currentOrg: null, role: null });
    // Full reload guarantees all server component caches + cookies are cleared
    // before landing on /login.
    window.location.assign("/login");
  },
  reset: () =>
    set({
      user: null,
      session: null,
      currentOrg: null,
      role: null,
      isLoading: false,
    }),
}));

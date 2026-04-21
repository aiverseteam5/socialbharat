import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { AuthHydrator } from "@/components/layout/AuthHydrator";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/stores/auth-store";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  const supabase = await createClient();
  const [
    {
      data: { session },
    },
    { data: membership },
  ] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from("org_members")
      .select("org_id, role, organizations(id, name, slug, plan)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!membership) {
    redirect("/onboarding");
  }

  const orgRaw = membership.organizations;
  const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as {
    id: string;
    name: string;
    slug: string;
    plan: string;
  } | null;
  const role = (membership.role as UserRole) ?? null;

  return (
    <div className="flex h-screen overflow-hidden">
      <AuthHydrator
        user={user}
        session={session}
        currentOrg={org}
        role={role}
      />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <MobileNav />
      <UpgradeModal />
    </div>
  );
}

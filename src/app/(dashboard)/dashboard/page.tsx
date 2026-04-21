import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenTool, Share2, BarChart3 } from "lucide-react";
import { t, getLocale } from "@/lib/i18n";
import { UpcomingFestivalsWidget } from "@/components/publishing/UpcomingFestivalsWidget";
import { DevUpgradeModalTrigger } from "@/components/billing/DevUpgradeModalTrigger";
import { OnboardingBanner } from "@/components/dashboard/OnboardingBanner";
import { requireAuth } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export default async function DashboardPage() {
  const locale = getLocale();
  const isDev = process.env.NODE_ENV === "development";

  const user = await requireAuth();
  const svc = createServiceClient();
  const { data: profile } = await svc
    .from("users")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  const accountType = profile?.account_type ?? "individual";

  return (
    <div className="space-y-6">
      <OnboardingBanner accountType={accountType} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {t("dashboard.welcome", locale)}
          </h1>
          <p className="text-muted-foreground">
            {t("dashboard.subtitle", locale)}
          </p>
        </div>
        {isDev && <DevUpgradeModalTrigger />}
      </div>

      {/* Main content + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Quick actions */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <PenTool className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {t("dashboard.compose_title", locale)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("dashboard.compose_desc", locale)}
                </p>
                <Button asChild size="sm" className="w-full">
                  <Link href="/publishing/compose">
                    {t("dashboard.create_post_cta", locale)}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Share2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {t("dashboard.connect_title", locale)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("dashboard.connect_desc", locale)}
                </p>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/settings/social-accounts">
                    {t("dashboard.connect_cta", locale)}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {t("dashboard.analytics_title", locale)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("dashboard.analytics_desc", locale)}
                </p>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/analytics">
                    {t("dashboard.view_analytics", locale)}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <UpcomingFestivalsWidget />
        </aside>
      </div>
    </div>
  );
}

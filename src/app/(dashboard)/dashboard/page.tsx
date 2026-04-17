import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenTool, Share2, BarChart3 } from "lucide-react";
import { t, getLocale } from "@/lib/i18n";

export default function DashboardPage() {
  const locale = getLocale();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("dashboard.welcome", locale)}</h1>
        <p className="text-muted-foreground">
          {t("dashboard.subtitle", locale)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <PenTool className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create and schedule posts across all your social profiles.
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
            <CardTitle className="text-base">Connect</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Link your social media accounts to start managing them here.
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
            <CardTitle className="text-base">Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Track performance across all your connected profiles.
            </p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/analytics">View Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

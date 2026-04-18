import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Link2, CreditCard, ShieldCheck } from "lucide-react";
import { t, getLocale } from "@/lib/i18n";

const sections = [
  {
    href: "/settings/team",
    icon: Users,
    titleKey: "settings.team_title",
    subtitleKey: "settings.team_subtitle",
  },
  {
    href: "/settings/social-accounts",
    icon: Link2,
    titleKey: "settings.social_accounts_title",
    subtitleKey: "settings.social_accounts_subtitle",
  },
  {
    href: "/settings/billing",
    icon: CreditCard,
    titleKey: "billing.title",
    subtitleKey: "billing.subtitle",
  },
  {
    href: "/settings/privacy",
    icon: ShieldCheck,
    titleKey: "settings.privacy_title",
    subtitleKey: "settings.privacy_subtitle",
  },
];

export default function SettingsIndex() {
  const locale = getLocale();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("settings.title", locale)}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ href, icon: Icon, titleKey, subtitleKey }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  {t(titleKey, locale)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t(subtitleKey, locale)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

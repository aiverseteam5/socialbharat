import { cn } from "@/lib/utils";

type LogoVariant = "default" | "white" | "icon-only";
type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const SIZE_MAP: Record<LogoSize, { icon: number; text: string; gap: string }> =
  {
    sm: { icon: 24, text: "text-lg", gap: "gap-2" },
    md: { icon: 32, text: "text-xl", gap: "gap-2.5" },
    lg: { icon: 48, text: "text-3xl", gap: "gap-3" },
  };

/**
 * Canonical SocialBharat brand mark.
 *
 * Always renders one word: "SocialBharat".
 *   - "Social" weight 300, slate (default) / white (white variant)
 *   - "Bharat" weight 700, brand blue (default) / white (white variant)
 *
 * Glyph is a blue rounded-square tile with a white "S" letter — placeholder
 * until the final brand PNG is produced. Swap the SVG body if/when assets land.
 */
export function Logo({
  variant = "default",
  size = "md",
  className,
}: LogoProps) {
  const { icon, text, gap } = SIZE_MAP[size];

  if (variant === "icon-only") {
    return <LogoGlyph size={icon} className={className} />;
  }

  const socialClass = variant === "white" ? "text-white" : "text-[#1E293B]";
  const bharatClass = variant === "white" ? "text-white" : "text-[#2563EB]";

  return (
    <span
      className={cn("inline-flex items-center tracking-tight", gap, className)}
    >
      <LogoGlyph size={icon} />
      <span className={cn("leading-none", text)}>
        <span className={cn("font-light", socialClass)}>Social</span>
        <span className={cn("font-bold", bharatClass)}>Bharat</span>
      </span>
    </span>
  );
}

interface LogoGlyphProps {
  size?: number;
  className?: string;
}

export function LogoGlyph({ size = 32, className }: LogoGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="SocialBharat"
    >
      <defs>
        <linearGradient
          id="sbLogoBg"
          x1="0"
          y1="0"
          x2="100"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" ry="22" fill="url(#sbLogoBg)" />
      <text
        x="50"
        y="54"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="62"
        fill="#FFFFFF"
        style={{ letterSpacing: "-0.04em" }}
      >
        S
      </text>
    </svg>
  );
}

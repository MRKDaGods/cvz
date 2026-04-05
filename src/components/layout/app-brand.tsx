import Link from "next/link";
import { cn } from "@/lib/utils";

interface AppBrandProps {
  href?: string;
  className?: string;
  showTagline?: boolean;
}

function BrandContent({ showTagline = true }: Pick<AppBrandProps, "showTagline">) {
  return (
    <div className="leading-none">
      <div className="font-heading text-[1.1rem] font-light tracking-[0.3em] uppercase text-foreground">
        CVZ
      </div>
      {showTagline ? (
        <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
          Resume Studio
        </div>
      ) : null}
    </div>
  );
}

export function AppBrand({ href, className, showTagline = true }: AppBrandProps) {
  const classes = cn(
    "inline-flex items-center gap-3 transition-opacity hover:opacity-90",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        <BrandContent showTagline={showTagline} />
      </Link>
    );
  }

  return (
    <div className={classes}>
      <BrandContent showTagline={showTagline} />
    </div>
  );
}
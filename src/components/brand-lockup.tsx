import { BrandMark } from "@/components/brand-mark";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLockupProps = {
  className?: string;
  compact?: boolean;
  name?: string;
  tagline?: string;
};

export function BrandLockup({
  className,
  compact = false,
  name = brand.name,
  tagline = brand.productTagline,
}: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark className={compact ? "size-9 rounded-lg" : "size-10 rounded-xl"} />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-[0.01em] text-foreground">
          {name}
        </span>
        {!compact && <span className="block text-[11px] text-muted-foreground">{tagline}</span>}
      </span>
    </span>
  );
}

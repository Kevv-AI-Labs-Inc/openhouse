import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  showRing?: boolean;
};

export function BrandMark({ className, showRing = false }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-xl",
        showRing && "ring-1 ring-black/5 ring-offset-2 ring-offset-transparent",
        className
      )}
    >
      <svg viewBox="0 0 48 48" className="size-full" role="img" aria-label="OpenHouse">
        <defs>
          <linearGradient id="openhouse-brand-mark" x1="6%" y1="4%" x2="96%" y2="96%">
            <stop offset="0%" stopColor="#0ea5a4" />
            <stop offset="48%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#openhouse-brand-mark)" />
        <path
          d="M12.5 23.5L24 14.5L35.5 23.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="16.5" y="22.5" width="15" height="11.5" rx="2.4" fill="#ffffff" />
        <rect x="22.2" y="26" width="3.5" height="8" rx="1.6" fill="#0d4260" />
      </svg>
    </span>
  );
}


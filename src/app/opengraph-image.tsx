import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

export const runtime = "edge";
export const alt = "OpenHouse — Agent operating platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          background:
            "radial-gradient(circle at 8% 10%, rgba(34,197,94,0.18), transparent 36%), radial-gradient(circle at 92% 12%, rgba(37,99,235,0.18), transparent 32%), linear-gradient(140deg, #f8feff 0%, #f2fbff 100%)",
          color: "#0f2940",
          padding: "64px",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <svg viewBox="0 0 48 48" width="56" height="56" aria-label="OpenHouse logo">
            <defs>
              <linearGradient id="og-openhouse-brand-mark" x1="6%" y1="4%" x2="96%" y2="96%">
                <stop offset="0%" stopColor="#0ea5a4" />
                <stop offset="48%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#og-openhouse-brand-mark)" />
            <path
              d="M12.5 23.5L24 14.5L35.5 23.5"
              fill="none"
              stroke="#fff"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="16.5" y="22.5" width="15" height="11.5" rx="2.4" fill="#fff" />
            <rect x="22.2" y="26" width="3.5" height="8" rx="1.6" fill="#0d4260" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "0.01em" }}>{brand.name}</div>
            <div style={{ fontSize: "18px", opacity: 0.72 }}>{brand.productTagline}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "920px" }}>
          <div style={{ fontSize: "62px", fontWeight: 700, lineHeight: 1.08 }}>
            Turn every open house into a measurable pipeline.
          </div>
          <div style={{ fontSize: "27px", lineHeight: 1.35, opacity: 0.78 }}>
            Branded sign-in, AI lead scoring, and seller-ready reporting in one operating system.
          </div>
        </div>

        <div style={{ display: "flex", gap: "18px" }}>
          {["Free + Pro plans", "North America focused", "Review-first AI workflow"].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid rgba(117,147,181,0.3)",
                background: "rgba(255,255,255,0.75)",
                borderRadius: "999px",
                padding: "8px 16px",
                fontSize: "17px",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

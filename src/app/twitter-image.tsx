import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

export const runtime = "edge";
export const alt = "OpenHouse product preview";
export const size = {
  width: 1200,
  height: 600,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          background:
            "radial-gradient(circle at 10% 15%, rgba(34,197,94,0.17), transparent 38%), radial-gradient(circle at 85% 80%, rgba(37,99,235,0.15), transparent 40%), linear-gradient(140deg, #f8feff 0%, #f1fbff 100%)",
          color: "#0f2940",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          padding: "50px 60px",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: "12px" }}>
          <svg viewBox="0 0 48 48" width="50" height="50" aria-label="OpenHouse logo">
            <defs>
              <linearGradient id="tw-openhouse-brand-mark" x1="6%" y1="4%" x2="96%" y2="96%">
                <stop offset="0%" stopColor="#0ea5a4" />
                <stop offset="48%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#tw-openhouse-brand-mark)" />
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
          <div style={{ fontSize: "30px", fontWeight: 700 }}>{brand.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "930px" }}>
          <div style={{ fontSize: "58px", fontWeight: 700, lineHeight: 1.08 }}>
            AI-native open house operations
          </div>
          <div style={{ fontSize: "26px", opacity: 0.88, lineHeight: 1.35 }}>
            Capture leads. Score intent. Ship seller-ready updates.
          </div>
        </div>

        <div style={{ fontSize: "19px", opacity: 0.74 }}>Free to start · Pro for advanced AI workflows</div>
      </div>
    ),
    {
      ...size,
    }
  );
}

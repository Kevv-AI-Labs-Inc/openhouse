import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/dashboard",
          "/dashboard/*",
          "/api",
          "/api/*",
          "/login",
          "/register",
          "/oh",
          "/oh/*",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: ["/"],
        disallow: ["/dashboard/*", "/api/*", "/oh/*"],
      },
      {
        userAgent: "Google-Extended",
        allow: ["/"],
        disallow: ["/dashboard/*", "/api/*", "/oh/*"],
      },
      {
        userAgent: "CCBot",
        allow: ["/"],
        disallow: ["/dashboard/*", "/api/*", "/oh/*"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}

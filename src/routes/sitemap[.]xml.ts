import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Production origin used for absolute <loc> URLs. Override per-host with the
// SITE_URL environment variable (e.g. https://careconnect.example.com).
const FALLBACK_BASE_URL = "https://careconnect.lovable.app";

function resolveBaseUrl(request: Request) {
  const configured = process.env.SITE_URL ?? process.env.VITE_SITE_URL;
  const base = configured || new URL(request.url).origin || FALLBACK_BASE_URL;
  return base.replace(/\/+$/, "");
}

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const BASE_URL = resolveBaseUrl(request);
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/auth", changefreq: "monthly", priority: "0.6" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

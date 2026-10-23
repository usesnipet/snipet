import type { APIRoute } from "astro";

/** Generated rather than static so the sitemap URL follows PUBLIC_SITE_URL. */
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap-index.xml", site).href}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

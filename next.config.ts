import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Preview deployments carry the Vercel toolbar, which loads from vercel.live.
// VERCEL_ENV is set at build time, when these headers are computed.
const isPreview = process.env.VERCEL_ENV === "preview";

/** The toolbar's sources for one directive on previews, nothing elsewhere. */
function toolbar(sources: string): string {
  return isPreview ? ` ${sources}` : "";
}

// Report-only: the browser logs violations and blocks nothing. It becomes
// Content-Security-Policy once a reporting endpoint exists and two weeks of
// reports are clean (FRONTEND_REVIEW C19, F1-7).
//
// script-src allows 'unsafe-inline' for now, deliberately: App Router streams
// its flight data in inline <script> tags, and without a nonce only
// 'unsafe-inline' lets them run. The alternative is the nonce flow, where
// proxy.ts mints a nonce per request and sends it in the CSP header for Next to
// stamp on its scripts. A per-request nonce means no page can be prerendered,
// so the pages that are static today would render on every request instead.
// That flow is the path to enforcing this policy without 'unsafe-inline' (with
// 'strict-dynamic'), taken once enforcement is worth giving up static rendering.
//
// On previews each directive the Vercel toolbar needs also lists the sources
// Vercel documents for it, so preview reports show only real violations.
const contentSecurityPolicy = [
  "default-src 'self'",
  // Inline for the flight scripts (above), wasm for the Draco decoder, and eval
  // only in next dev, for hot reload.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}${toolbar("https://vercel.live")}`,
  // Mapbox GL and DRACOLoader run their workers from blob: URLs.
  "worker-src 'self' blob:",
  `connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://assets.artrium.space https://www.gstatic.com${toolbar("https://vercel.live wss://ws-us3.pusher.com")}`,
  `img-src 'self' data: blob: https://*.mapbox.com https://assets.artrium.space https://picsum.photos${toolbar("https://vercel.live https://vercel.com")}`,
  `style-src 'self' 'unsafe-inline'${toolbar("https://vercel.live")}`,
  // next/font self-hosts the fonts.
  `font-src 'self'${toolbar("https://vercel.live https://assets.vercel.com")}`,
  // Frames otherwise fall back to default-src 'self'.
  ...(isPreview ? ["frame-src 'self' https://vercel.live"] : []),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

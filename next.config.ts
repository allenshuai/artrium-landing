import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Report-only: the browser logs violations and blocks nothing. It becomes
// Content-Security-Policy once a reporting endpoint exists and two weeks of
// reports are clean (FRONTEND_REVIEW C19, F1-7).
const contentSecurityPolicy = [
  "default-src 'self'",
  // App Router's inline flight scripts need 'unsafe-inline' without nonces, the
  // Draco decoder needs wasm, and next dev evaluates code for hot reload.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  // Mapbox GL and DRACOLoader run their workers from blob: URLs.
  "worker-src 'self' blob:",
  "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://assets.artrium.space https://www.gstatic.com",
  "img-src 'self' data: blob: https://*.mapbox.com https://assets.artrium.space https://picsum.photos",
  "style-src 'self' 'unsafe-inline'",
  // next/font self-hosts the fonts.
  "font-src 'self'",
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

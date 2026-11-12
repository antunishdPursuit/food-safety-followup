const isDev = process.env.NODE_ENV !== 'production';

// A read-only snapshot (npm run build:snapshot) is a static export: plain files for a free static host. It leaves
// out the API routes (only .jsx files are pages) and cannot set headers, so the host's defaults apply.
const snapshot = process.env.NEXT_PUBLIC_SNAPSHOT === '1';

// The page needs its scripts and styles from this site (Next writes small inline scripts; Leaflet sets inline
// styles) and map tiles from OpenStreetMap. Nothing else loads from outside, and no other site may frame the page.
// Development also needs eval and a websocket for hot reloading.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = snapshot
  ? {
    agentRules: false,
    output: 'export',
    trailingSlash: true,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    pageExtensions: ['jsx'],
    images: { unoptimized: true },
  }
  : {
    agentRules: false,
    poweredByHeader: false,
    async headers() {
      return [{ source: '/:path*', headers: securityHeaders }];
    },
  };

export default nextConfig;

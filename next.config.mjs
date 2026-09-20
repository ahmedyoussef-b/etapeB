/** @type {import('next').NextConfig} */

// Mode DESKTOP : export statique pour embarquement Tauri
const isDesktop = process.env.BUILD_TARGET === 'desktop';

const nextConfig = isDesktop
  ? {
      // Export statique (pages HTML + assets, sans serveur)
      output: 'export',
      distDir: 'out',
      images: { unoptimized: true },
      trailingSlash: true,
    }
  : {
      // Headers CORS pour les routes /api/* (H2 — next.config.mjs)
      // Allow-Origin: * — les routes sync sont protégées par withAuth (token côté serveur)
      // Next.js gère automatiquement les réponses OPTIONS (preflight)
      async headers() {
        return [
          {
            source: '/api/:path*',
            headers: [
              { key: 'Access-Control-Allow-Origin', value: '*' },
              { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
              { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
              { key: 'Access-Control-Max-Age', value: '86400' },
            ],
          },
        ];
      },
    };
// Mode WEB (défaut) : comportement actuel avec /api/*

export default nextConfig;

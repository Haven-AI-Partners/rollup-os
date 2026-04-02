import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "bcryptjs",
  ],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@ai-sdk/google",
      "@ai-sdk/openai",
      "@ai-sdk/moonshotai",
      "@ai-sdk/react",
      "ai",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "radix-ui",
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://*.clerk.accounts.dev https://clerk.rollup-os.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.clerk.com https://*.googleusercontent.com https://clerk.rollup-os.com; font-src 'self' data:; connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.rollup-os.com https://accounts.google.com https://*.googleapis.com https://*.google.com https://*.langfuse.com https://*.vercel-insights.com https://vitals.vercel-insights.com; frame-src 'self' https://accounts.google.com https://*.clerk.accounts.dev https://clerk.rollup-os.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
        },
      ],
    },
  ],
};

export default withBundleAnalyzer(nextConfig);

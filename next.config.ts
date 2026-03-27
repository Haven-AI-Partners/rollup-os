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
      ],
    },
  ],
};

export default withBundleAnalyzer(nextConfig);

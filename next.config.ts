import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF rendering runs in Node route handlers; keep it out of the bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
  poweredByHeader: false,
};

export default nextConfig;

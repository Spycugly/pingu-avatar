import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Import only the Phosphor icons in use, not the whole barrel.
  experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
  // The customizer used to live at /esplora; it is the home page now (?tab= is passed through).
  async redirects() {
    return [{ source: "/esplora", destination: "/", permanent: false }];
  },
};

export default nextConfig;

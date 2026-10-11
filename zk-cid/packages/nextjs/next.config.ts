import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    // Server-side-only escape hatch. Deliberately not NEXT_PUBLIC_ so the flag can never be
    // inlined into the client bundle.
    ignoreBuildErrors: process.env.IGNORE_BUILD_ERROR === "true",
  },
  webpack: config => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      os: false,
      path: false,
      readline: false,
    };
    return config;
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

export default nextConfig;

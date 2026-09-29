import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: { serverActions: { bodySizeLimit: "1mb" } },
};

export default config;

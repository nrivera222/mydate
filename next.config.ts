import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite es un módulo nativo de Node; nunca debe empaquetarse.
  serverExternalPackages: [],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;

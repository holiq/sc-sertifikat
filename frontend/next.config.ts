import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    root: __dirname,
  },
  basePath: "/sc-sertifikat",
  assetPrefix: "/sc-sertifikat/",
};

export default nextConfig;

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: configDir,
  },
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "pdfjs-dist"],
  poweredByHeader: false,
  allowedDevOrigins: [
    "sapadarsi.hcm-lab.id",
    "darsi.cs.hcm-lab.id",
    "localhost",
    "127.0.0.1",
    "10.9.23.205",
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SVG tracer (lib/svg/trace.ts) runs on the server only; load these with plain Node require.
  serverExternalPackages: ["potrace", "jimp"],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STRATA_STANDALONE === "true" ? "standalone" : undefined,
  // These are copied explicitly into the container; never trace a local venv or secrets.
  outputFileTracingExcludes: { "/*": ["./pipeline/.venv/**/*", "./pipeline/.uv-cache/**/*", "./.env*"] },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native binaries / wasm must be resolved from node_modules at runtime.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "@electric-sql/pglite", "pg"],
  // Used by the desktop packager (Electron) – a self-contained server folder.
  output: process.env.CLIPFORGE_DESKTOP_BUILD ? "standalone" : undefined,
  outputFileTracingIncludes: {
    "/**": ["./assets/fonts/**/*"],
  },
  poweredByHeader: false,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client ships native bindings for the local file: driver; keep it out
  // of the bundler so it loads as a normal Node module in dev and on the server.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;

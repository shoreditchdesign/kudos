import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @resvg/resvg-js ships a native binding that the bundler can't process.
  // Mark it external so Next leaves the require() in place at runtime.
  serverExternalPackages: ["@resvg/resvg-js"],
  // Hide Next's dev-mode bottom-left indicator (the "N" / Static-route badge).
  devIndicators: false,
};

export default nextConfig;

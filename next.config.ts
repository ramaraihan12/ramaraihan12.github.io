import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages only serves files, so the whole site is exported to out/ at build time.
  output: "export",
  // There's no image server behind a static export. The one photo is already sized for the page.
  images: { unoptimized: true },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "@github/copilot-sdk",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
  ],
};

export default nextConfig;

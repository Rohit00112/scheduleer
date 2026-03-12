import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: [
    "exceljs",
    "jsonwebtoken",
    "pg",
    "sqlite3",
    "twilio",
    "typeorm",
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run 用に最小構成のサーバーを出力する
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

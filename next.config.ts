import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api-assets.clashroyale.com" },
    ],
  },
};

export default config;

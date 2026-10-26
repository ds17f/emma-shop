import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }, {
      source: "/uploads/:path*",
      // Also covers uploads indexed and served directly from public at startup.
      headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; sandbox" }],
    }];
  },
};

export default nextConfig;

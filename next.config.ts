import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Buyers pay through hosted Stripe Checkout (redirect, never an embed);
  // storefronts are ISR'd. Feature config lands with the phases that need it.
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;

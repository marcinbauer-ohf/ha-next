import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets a second dev server (`npm run dock`) compile into its own directory so
  // two Next instances on one checkout don't fight over .next. Unset — which is
  // every normal run — leaves the default untouched.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;

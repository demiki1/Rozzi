/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a minimal .next/standalone output (only the files actually
  // needed to run the app) — see Dockerfile, which copies just that
  // instead of the full node_modules tree.
  output: 'standalone',
};

module.exports = nextConfig;

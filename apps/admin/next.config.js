/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Produces a minimal .next/standalone output (only the files actually
  // needed to run the app) — see Dockerfile, which copies just that
  // instead of the full node_modules tree.
  output: 'standalone',
  // Keep the existing @/* TypeScript alias usable by webpack in the
  // production build as well as the editor/type-checker.
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;

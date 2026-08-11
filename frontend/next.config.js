/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: { allowedOrigins: ["localhost"] },
  },
};

module.exports = nextConfig;

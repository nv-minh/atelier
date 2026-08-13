/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_GOOGLE_ENABLED: process.env.GOOGLE_CLIENT_ID ? "1" : "0",
    NEXT_PUBLIC_GITHUB_ENABLED: process.env.GITHUB_CLIENT_ID ? "1" : "0",
    NEXT_PUBLIC_AUTH_BYPASS: process.env.AUTH_BYPASS === "1" ? "1" : "0",
  },
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Native module used to render scanned PDF pages for IEP extraction.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;

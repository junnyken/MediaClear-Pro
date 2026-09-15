/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mediaclear/contracts', '@mediaclear/design-tokens', '@mediaclear/i18n'],
};
export default nextConfig;

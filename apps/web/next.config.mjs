/** @type {import('next').NextConfig} */

/*
 * `MEDIACLEAR_API_PROXY_TARGET` — cho phep trinh duyet goi API qua CUNG MOT GOC voi giao dien.
 *
 * VI SAO CAN: giao dien nhung `window.__MCP_API_BASE__` tu `MEDIACLEAR_API_BASE_URL` luc dung trang.
 * Khi may chu chay trong mot container/workspace tu xa, gia tri do (`http://127.0.0.1:3301`) dung o
 * BEN TRONG nhung sai o TRINH DUYET cua nguoi dung — `127.0.0.1` khi do la may CUA HO. Ket qua la
 * trang hien ra binh thuong roi bao "Khong ket noi duoc may chu", va nguoi doc de tuong la may chu
 * chet trong khi no dang chay.
 *
 * Bat bien nay thi Next chuyen tiep `/v1/*` va `/healthz` sang API o phia may chu, nen chi can
 * chuyen tiep DUNG MOT cong (cong cua giao dien).
 *
 * TAT mac dinh: ban trien khai that co API o mot ten mien rieng, khong di qua duong nay.
 */
const proxyTarget = process.env.MEDIACLEAR_API_PROXY_TARGET;

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mediaclear/contracts', '@mediaclear/design-tokens', '@mediaclear/i18n'],
  async rewrites() {
    if (!proxyTarget) return [];
    return [
      { source: '/v1/:path*', destination: `${proxyTarget}/v1/:path*` },
      { source: '/healthz', destination: `${proxyTarget}/healthz` },
    ];
  },
};
export default nextConfig;

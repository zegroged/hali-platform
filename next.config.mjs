/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Eski liste adresi kalıcı (308) olarak ana sayfaya yönlenir;
  // query parametreleri (district, lat, lng, q) Next tarafından otomatik korunur.
  async redirects() {
    return [{ source: "/halicilar", destination: "/", permanent: true }];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Teknoloji parmak izini sızdırma: X-Powered-By başlığını kapat.
  poweredByHeader: false,
  // Şoför teslim/alım fotoğrafları server action ile yüklenir; telefon
  // fotoğrafları varsayılan 1MB limitine sığmaz.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  // Eski liste adresi kalıcı (308) olarak ana sayfaya yönlenir;
  // query parametreleri (district, lat, lng, q) Next tarafından otomatik korunur.
  async redirects() {
    return [{ source: "/halicilar", destination: "/", permanent: true }];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // iyzipay istemcisi kurulurken kendi resources/ klasörünü diskten okur;
  // bundle'a girince __dirname değişip ENOENT ile sayfayı 500'e düşürüyordu
  // (PAYMENTS_MODE=live'da panel çöktü, 2026-07-13). Paket bundle DIŞINDA kalmalı.
  serverExternalPackages: ["iyzipay"],
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

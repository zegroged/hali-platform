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
  // Güvenlik yanıt başlıkları (tüm yollar). CSP'nin script/style kuralları
  // Next.js inline'larını kırdığından (nonce gerektirir) şimdilik yalnız
  // frame-ancestors (clickjacking) + upgrade-insecure-requests uygulanır;
  // tam CSP lansman sonrası nonce ile eklenecek. Konum/kamera 'self' KALIR
  // (müşteri konum seçimi + şoför fotoğraf çekimi bunlara muhtaç).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(self), microphone=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; upgrade-insecure-requests",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

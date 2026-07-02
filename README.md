# Halı Yıkama Platformu

Müşterinin konumuna göre halıcı seçtiği, halıcının kendi şoförüne otomatik iş düşen,
müşterinin halısını adım adım takip ettiği pazar yeri uygulaması.

## Model (özet)

- **Gelir:** Halıcıdan abonelik (2.000 TL/ay). Kartla ödemede ek %3 komisyon. Komisyonsuz nakit seçeneği de var.
- **Keşif:** Müşteri konum girer → o bölgeye hizmet veren halıcılar **mesafe + puan** sıralamasıyla listelenir.
- **Atama:** Müşteri halıcıyı seçer → iş o halıcının **kendi şoförüne** düşer (şoför kabul/ret yazabilir).
- **Takip:** Sipariş durumu (alındı → yıkanıyor → yolda → teslim) + canlı şoför konumu (halıcı için).
- **Kayıt:** Şoför durak kaydı — "şu saatte, şu konumda, şu kadar durdu" — **aylık** rapor.
- **Güven:** Doğrulanmış İşletme rozeti (vergi no, telefon, profil, sözleşme) + Sigortalı / Hızlı Teslim / Çok Tercih Edilen / Hızlı Yanıt rozetleri.

## Teknoloji

- Next.js 15 (App Router, PWA) + TypeScript + Tailwind
- PostgreSQL + Prisma
- Ödeme (iyzico) ve SMS: şimdilik **mock**
- Docker + Docker Compose

## Geliştirme

```bash
# 1) Veritabanını başlat (Postgres, Docker)
docker compose up -d db

# 2) Bağımlılıklar
npm install

# 3) Şemayı veritabanına uygula
npm run db:push

# 4) Geliştirme sunucusu
npm run dev    # http://localhost:3000
```

## Tam container testi

```bash
docker compose up --build   # uygulama + veritabanı
```

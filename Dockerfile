# --- bağımlılıklar ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- derleme ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# NEXT_PUBLIC_* anahtarlar derleme ANINDA istemci koduna gömülür (.env
# .dockerignore'da olduğu için build bunu ancak arg olarak görebilir).
# Boş gelirse LiveMap ücretsiz OSM'ye düşer — güvenli varsayılan.
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY
# FİYAT MERDİVENİ istemci tarafı için: /kayit bir client component ve orada
# yalnız NEXT_PUBLIC_* değişkenleri okunabilir (derleme anında gömülür).
# Sunucu tarafı FIYAT_MERDIVENI ile çalışır; ikisi BİRLİKTE set edilmeli.
ARG NEXT_PUBLIC_FIYAT_MERDIVENI
ENV NEXT_PUBLIC_FIYAT_MERDIVENI=$NEXT_PUBLIC_FIYAT_MERDIVENI
# Server Action şifreleme anahtarı: build'e gömülünce action kimlikleri deploy'lar
# arası SABİT kalır → yeniden dağıtım, kullanıcının açık sekmesindeki formu
# "Failed to find Server Action" ile bozmaz. Runtime'da da (.env) aynısı verilir.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
# TİCARİ KÜNYE — yasal sayfalar (hakkımızda/iletişim/kvkk/...) statik ön-üretilir
# ve Footer client bundle'a girer; her ikisi de yalnız NEXT_PUBLIC_* görür.
# .env .dockerignore'da olduğu için build bunları ARG olarak almak zorunda.
# Boş gelirse sayfalar "[VKN]/[KEP]" yer tutucusu basar (ETAHS md.6/1 eksikliği).
ARG NEXT_PUBLIC_SIRKET_TICARI_AD
ENV NEXT_PUBLIC_SIRKET_TICARI_AD=$NEXT_PUBLIC_SIRKET_TICARI_AD
ARG NEXT_PUBLIC_SIRKET_YASAL_AD
ENV NEXT_PUBLIC_SIRKET_YASAL_AD=$NEXT_PUBLIC_SIRKET_YASAL_AD
ARG NEXT_PUBLIC_SIRKET_ISLETME_TURU
ENV NEXT_PUBLIC_SIRKET_ISLETME_TURU=$NEXT_PUBLIC_SIRKET_ISLETME_TURU
ARG NEXT_PUBLIC_SIRKET_ADRES
ENV NEXT_PUBLIC_SIRKET_ADRES=$NEXT_PUBLIC_SIRKET_ADRES
ARG NEXT_PUBLIC_SIRKET_SEHIR
ENV NEXT_PUBLIC_SIRKET_SEHIR=$NEXT_PUBLIC_SIRKET_SEHIR
ARG NEXT_PUBLIC_SIRKET_VERGI_DAIRESI
ENV NEXT_PUBLIC_SIRKET_VERGI_DAIRESI=$NEXT_PUBLIC_SIRKET_VERGI_DAIRESI
ARG NEXT_PUBLIC_SIRKET_VERGI_NO
ENV NEXT_PUBLIC_SIRKET_VERGI_NO=$NEXT_PUBLIC_SIRKET_VERGI_NO
ARG NEXT_PUBLIC_SIRKET_KEP
ENV NEXT_PUBLIC_SIRKET_KEP=$NEXT_PUBLIC_SIRKET_KEP
ARG NEXT_PUBLIC_SIRKET_TELEFON
ENV NEXT_PUBLIC_SIRKET_TELEFON=$NEXT_PUBLIC_SIRKET_TELEFON
ARG NEXT_PUBLIC_SIRKET_EPOSTA
ENV NEXT_PUBLIC_SIRKET_EPOSTA=$NEXT_PUBLIC_SIRKET_EPOSTA
RUN npm run build

# --- çalıştırma ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Şemayı başlangıçta uygulayabilmek için Prisma CLI + motorlarını da taşı.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Foto upload dizinini önceden oluştur — named volume bu (nextjs) sahipliğini
# devralır, böylece ayrıcalıksız kullanıcı yazabilir.
RUN mkdir -p /app/public/uploads
# Root değil, ayrıcalıksız kullanıcı ile çalış.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
# Boş/şemasız DB → kesinti olmasın: önce şemayı uygula, sonra sunucuyu başlat.
# NOT: db push hızlı başlangıç içindir; sürüm geçmişi gereken üretimde
# `prisma migrate deploy` ile versiyonlanmış migration tercih edilmeli.
# --accept-data-loss ŞART: unique-kısıt/kolon-tipi değişikliklerinde db push
# aksi halde onay bekleyip başarısız olur ve app AÇILMAZ (crash-loop). Yaşandı:
# 2026-07-09 iyzicoSubRef @unique eklenince prod down oldu. (Geri dönüşü olmayan
# şema değişikliklerinde önce elle/migration ile uygula, sonra deploy et.)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss && node server.js"]

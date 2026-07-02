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
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]

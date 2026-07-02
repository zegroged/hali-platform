import { PrismaClient } from "@prisma/client";
import { validateConfig } from "@/lib/config";

// İlk veri erişiminde (≈ ilk istek) kritik yapılandırmayı doğrula; eksikse başlangıçta dur.
validateConfig();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

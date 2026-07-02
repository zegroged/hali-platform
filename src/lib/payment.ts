// Komisyon hesabı. Kartlı (CARD) ödemede platform komisyonu alınır; nakit (CASH) yok.
// NOT: Gerçek kart çekimi server-side YAPILMAZ — iyzico Checkout Form akışı
// (api/pay/iyzico/init → callback) ile müşteri öder. Burada yalnız komisyon hesabı var.
import type { PaymentMethod } from "@prisma/client";

const RATE = Number(process.env.PLATFORM_COMMISSION_RATE ?? "0.03");

export function commissionFor(method: PaymentMethod, total: number): number {
  if (method !== "CARD") return 0;
  const safe = Number.isFinite(total) && total > 0 ? total : 0;
  return Math.round(safe * RATE * 100) / 100;
}

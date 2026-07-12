import { trNowParts } from "@/lib/time";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_KEY = "weeklyDigestSentAt";

/**
 * Haftalık platform özeti — pazartesi günleri yöneticinin destek kutusuna
 * gider (panele girmeden nabız). instrumentation saat başı çağırır; AppState
 * işareti sayesinde haftada bir kez gönderilir (yeniden başlatmada mükerrer
 * mail yok). Best-effort: hata açılışı/zamanlayıcıyı bozmamalı.
 */
export async function maybeSendWeeklyDigest(): Promise<void> {
  const { day } = trNowParts();
  if (day !== 1) return; // yalnız TR pazartesi

  const { prisma } = await import("@/lib/prisma");
  const state = await prisma.appState.findUnique({ where: { key: STATE_KEY } });
  if (state && Date.now() - new Date(state.value).getTime() < WEEK_MS - 60_000)
    return; // bu hafta gönderildi

  const since = new Date(Date.now() - WEEK_MS);
  const [orders, delivered, newBusinesses, liveCount, reviews, leads] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: since } } }),
      prisma.order.count({
        where: { status: "DELIVERED", updatedAt: { gte: since } },
      }),
      prisma.cleanerBusiness.count({ where: { createdAt: { gte: since } } }),
      prisma.cleanerBusiness.count({
        where: { isVisible: true, verification: { not: "REJECTED" } },
      }),
      prisma.review.findMany({
        where: { createdAt: { gte: since } },
        select: { rating: true },
      }),
      prisma.cityLead.groupBy({
        by: ["city"],
        where: { createdAt: { gte: since } },
        _count: true,
        orderBy: { _count: { city: "desc" } },
        take: 5,
      }),
    ]);

  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;
  const leadLine =
    leads.length > 0
      ? leads.map((l) => `${l.city} (${l._count})`).join(", ")
      : "yeni kayıt yok";

  // Önce işaretle — mail sağlayıcı yavaşken çifte gönderim olmasın.
  await prisma.appState.upsert({
    where: { key: STATE_KEY },
    update: { value: new Date().toISOString() },
    create: { key: STATE_KEY, value: new Date().toISOString() },
  });

  const { sendAdminEmail } = await import("@/lib/email");
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#64748b;">${label}</td><td style="padding:6px 0;font-weight:bold;">${value}</td></tr>`;
  await sendAdminEmail(
    "📊 Haftalık özet — En Yakın Halı Yıkama",
    `<p style="margin:0 0 12px;"><strong>Geçen 7 günün özeti:</strong></p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px;">
       ${row("Yeni sipariş", String(orders))}
       ${row("Teslim edilen", String(delivered))}
       ${row("Yeni işletme kaydı", String(newBusinesses))}
       ${row("Şu an yayında işletme", String(liveCount))}
       ${row("Yeni değerlendirme", avg ? `${reviews.length} yorum · ort. ${avg}★` : "yok")}
       ${row("Şehir talepleri (haber ver)", leadLine)}
     </table>
     <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Detay: <a href="https://enyakinhaliyikamaservisi.com/admin" style="color:#0f766e;">/admin</a> · <a href="https://enyakinhaliyikamaservisi.com/admin/talepler" style="color:#0f766e;">/admin/talepler</a></p>`,
  );
  console.log("[haftalik-ozet] gonderildi");
}

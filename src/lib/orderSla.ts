import { prisma } from "@/lib/prisma";
import { notify, notifyAdmins } from "@/lib/notify";
import { sendSms } from "@/lib/sms";
import { sendEmail, wrapEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/config";

const HOUR_MS = 60 * 60 * 1000;

// E-postaya giren kullanıcı verisi (işletme adı, müşteri adı) HTML olarak
// yorumlanmasın — güvenilir alan adımızdan phishing/HTML enjeksiyonu olmasın.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
export const REMIND_AFTER_MS = 2 * HOUR_MS; // işletmeye hatırlatma eşiği
export const ESCALATE_AFTER_MS = 24 * HOUR_MS; // admin + müşteri kademesi

/**
 * Sipariş SLA bekçisi — pazar yerini öldüren şey sessizliktir: CREATED'da
 * bekleyen sipariş 2 saatte işletmeye HATIRLATILIR, 24 saatte adminlere zil +
 * (üye müşteriyse) müşteriye e-posta gider. Sipariş başına her kademe BİR KEZ
 * (staleRemindedAt / staleEscalatedAt işaretleri). instrumentation saat başı
 * çağırır; best-effort — hata zamanlayıcıyı bozmamalı (çağıran yakalar).
 * Misafir müşterinin 24s bilgisi takip sayfasından verilir (waitingLong +
 * alternatif öneriler — /api/orders/[token]).
 */
export async function checkStaleOrders(): Promise<void> {
  const now = Date.now();

  // Kademe 1 — 2 saat: işletme sahibine zil + SMS ("siparişin çürüyor").
  // isManual hariç: panelden açılan kayda işletmenin "yanıt vermesi" anlamsız.
  const remindables = await prisma.order.findMany({
    where: {
      status: "CREATED",
      isManual: false,
      createdAt: { lt: new Date(now - REMIND_AFTER_MS) },
      staleRemindedAt: null,
      // DEMO panelde "bekleyen talep" bilerek duruyor (satışta gösterilecek).
      // Bekçi onu gerçek sanıp uydurma numaraya SMS atmasın (2026-07-30).
      business: { isDemo: false },
    },
    select: {
      id: true,
      code: true,
      trackingToken: true,
      customerName: true,
      createdAt: true,
      business: { select: { name: true, phone: true, ownerId: true } },
    },
    take: 50,
  });
  for (const o of remindables) {
    // Önce işaretle: bildirim yavaş/hatalı olsa da ikinci tur mükerrer atmasın.
    await prisma.order.update({
      where: { id: o.id },
      data: { staleRemindedAt: new Date() },
    });
    const ref = o.code ?? o.trackingToken;
    await notify({
      userId: o.business.ownerId,
      type: "genel",
      title: "Bekleyen siparişin var!",
      body: `${o.customerName} (${ref}) 2 saattir yanıt bekliyor — kabul et ya da reddet, müşteri kaçmasın.`,
      href: "/panel/siparisler",
    });
    try {
      await sendSms(
        o.business.phone,
        `Bekleyen siparis! ${ref} 2 saattir yanitsiz. Kabul/red icin: ${getAppBaseUrl()}/panel/siparisler`,
      );
    } catch (e) {
      console.error("[siparis-sla] hatirlatma SMS hatasi:", e);
    }
  }

  // Kademe 2 — 24 saat: adminlere zil (hangi işletme çürütüyor) + üye
  // müşteriye "beklemek zorunda değilsin" e-postası.
  const escalatables = await prisma.order.findMany({
    where: {
      status: "CREATED",
      isManual: false,
      createdAt: { lt: new Date(now - ESCALATE_AFTER_MS) },
      staleEscalatedAt: null,
      // Demo siparişi adminlere "işletme siparişi bekletiyor" diye zil çaldırmasın.
      business: { isDemo: false },
    },
    select: {
      id: true,
      code: true,
      trackingToken: true,
      customerName: true,
      customerEmail: true,
      business: { select: { name: true } },
      customer: { select: { email: true } },
    },
    take: 50,
  });
  for (const o of escalatables) {
    await prisma.order.update({
      where: { id: o.id },
      data: { staleEscalatedAt: new Date() },
    });
    const ref = o.code ?? o.trackingToken;
    await notifyAdmins({
      type: "genel",
      title: "Sipariş 24 saattir yanıtsız",
      body: `${o.business.name} · ${ref} — işletme siparişi bekletiyor.`,
      href: "/admin",
    });
    // Üye e-postası > sipariş formuna yazılan e-posta (misafir de haber alsın)
    const email = o.customer?.email ?? o.customerEmail;
    if (email) {
      const url = `${getAppBaseUrl()}/takip/${o.trackingToken}`;
      try {
        await sendEmail(
          email,
          "Siparişin hakkında — işletme henüz yanıt vermedi",
          `${o.business.name} siparişini (${ref}) henüz yanıtlamadı. Beklemek istemezsen takip sayfandan iptal edip bölgendeki diğer halıcılara bakabilirsin: ${url}`,
          wrapEmail(
            `<p style="margin:0 0 12px;">Merhaba ${esc(o.customerName)},</p>
             <p style="margin:0 0 12px;"><strong>${esc(o.business.name)}</strong>, siparişini (${ref}) <strong>24 saattir yanıtlamadı</strong>. Özür dileriz — bu beklenen bir süre değil.</p>
             <p style="margin:0 0 16px;">Beklemek zorunda değilsin: takip sayfandan siparişini iptal edebilirsin; bölgende başka halıcı varsa aynı sayfada onları da göreceksin.</p>
             <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">Siparişimi görüntüle</a></p>
             <p style="margin:0;color:#64748b;font-size:13px;">İşletme bu arada yanıt verirse takip sayfan otomatik güncellenir.</p>`,
          ),
        );
      } catch (e) {
        console.error("[siparis-sla] musteri e-posta hatasi:", e);
      }
    }
  }

  if (remindables.length || escalatables.length) {
    console.log(
      `[siparis-sla] ${remindables.length} hatırlatma, ${escalatables.length} eskalasyon`,
    );
  }
}

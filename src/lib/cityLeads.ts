import { prisma } from "@/lib/prisma";
import { sendEmail, wrapEmail } from "@/lib/email";
import { activeSubscriptionWhere } from "@/lib/subscription";
import { CITIES, locative } from "@/lib/cities";
import { getAppBaseUrl } from "@/lib/config";

/**
 * "Açılınca haber ver" döngüsünün kapanışı: işletme kamuya açık listeye
 * girdiği an (görünür + reddedilmemiş + aktif abonelik) o şehirde bekleyen
 * CityLead kayıtlarına BİR KEZ müjde maili atar. syncVisibility'nin sonunda
 * çağrılır — idempotent (notifiedAt işareti), bekleyen yoksa tek ucuz sorgu.
 * Best-effort: mail hatası akışı bozmamalı, çağıran try/catch'lemeli.
 */
export async function notifyCityLeadsIfOpen(businessId: string): Promise<void> {
  const b = await prisma.cleanerBusiness.findFirst({
    where: {
      id: businessId,
      isVisible: true,
      verification: { not: "REJECTED" },
      subscription: activeSubscriptionWhere(),
    },
    select: { city: true },
  });
  if (!b) return;

  const leads = await prisma.cityLead.findMany({
    where: { city: b.city, notifiedAt: null },
    select: { id: true, email: true, district: true },
  });
  if (leads.length === 0) return;

  const slug = CITIES.find((c) => c.name === b.city)?.slug;
  const base = getAppBaseUrl();
  const url = slug ? `${base}/hali-yikama/${slug}` : base;
  const loc = locative(b.city);

  for (const lead of leads) {
    // PER-LEAD ATOMİK CLAIM (denetim bulgusu): toplu updateMany kısmi claim
    // yapıp yine de TÜM lead'lere mail atabiliyordu (eşzamanlı iki çağrı çift
    // mail). Her lead'i tek tek null→now çevir; yalnız bu çağrı çevirdiyse
    // (count===1) mail at. Başkası çoktan sahiplendiyse atla.
    const claim = await prisma.cityLead.updateMany({
      where: { id: lead.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    if (claim.count === 0) continue;
    try {
      await sendEmail(
        lead.email,
        `${b.city} için beklediğin halı yıkama hizmeti açıldı 🎉`,
        `${loc} halı yıkama hizmeti başladı. Halıcıları gör ve halın kapından alınsın: ${url}`,
        wrapEmail(
          `<p style="margin:0 0 12px;"><strong>Müjde — ${loc} açıldık!</strong></p>
           <p style="margin:0 0 16px;">Bir süre önce ${b.city} sayfamızda "hizmet açılınca haber ver" kaydı bırakmıştın. Beklediğin gün geldi: ${loc} artık halı yıkama işletmesi hizmet veriyor. Halın kapından alınır, yıkanır, kapına teslim edilir — ön ödeme yok, ödeme teslimde.</p>
           <p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">${b.city} halıcılarını gör</a></p>
           <p style="margin:0;color:#64748b;font-size:13px;">Bu e-postayı, ${b.city} sayfasında bıraktığın kayıt nedeniyle yalnızca bir kez aldın; e-posta adresin başka amaçla kullanılmaz.</p>`,
        ),
      );
    } catch {
      // Tek adresin hatası kalanları engellemesin.
    }
  }
}

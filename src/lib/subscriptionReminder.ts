import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendEmail, wrapEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/config";

// ABONELİK YENİLEME BEKÇİSİ (2026-07-25).
// NEDEN: iyzico abonelik akışı NON3D olduğu için BANKA KARTLI işletmeler düzenli
// ödeme talimatı VEREMİYOR (hata 10217) — her ay elle ödemek zorundalar. Hatırlatma
// olmazsa dönem sessizce doluyor, işletme keşiften düşüyor, ne o fark ediyor ne biz.
// NE YAPAR: (1) dönem bitimine ≤3 gün kalan ve talimatı OLMAYAN aboneliklere
// "yenileme zamanı" zil + e-posta, (2) dönemi dolanlara "yayından düştün" bildirimi.
// Dönem başına TEK kez (renewalRemindedFor / expiredNotifiedFor = o dönemin sonu).
// Saat başı tik'ten çağrılır; best-effort — hata zamanlayıcıyı bozmaz.

const GUN_MS = 24 * 60 * 60 * 1000;
const HATIRLATMA_ESIGI_MS = 3 * GUN_MS;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const trGun = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

export async function checkSubscriptionRenewals(): Promise<void> {
  const simdi = new Date();
  const base = getAppBaseUrl();

  // ---- 1) Yaklaşan dönem sonu (≤3 gün) — yalnız ELLE ödeyenler ----
  // autoRenew olanlarda iyzico kendi çekiyor; onlara hatırlatma gürültüdür.
  const yaklasanlar = await prisma.subscription.findMany({
    where: {
      autoRenew: false,
      status: { in: ["ACTIVE", "TRIAL"] },
      currentPeriodEnd: {
        gt: simdi,
        lte: new Date(simdi.getTime() + HATIRLATMA_ESIGI_MS),
      },
    },
    select: {
      businessId: true,
      currentPeriodEnd: true,
      renewalRemindedFor: true,
      business: {
        select: { name: true, owner: { select: { id: true, email: true } } },
      },
    },
  });

  for (const s of yaklasanlar) {
    const son = s.currentPeriodEnd!;
    // Bu dönem için zaten gönderildiyse geç (dönem başına tek mail).
    if (s.renewalRemindedFor && s.renewalRemindedFor.getTime() === son.getTime()) {
      continue;
    }
    // İŞARETİ ÖNCE ATOMİK KOY: e-posta patlasa bile her saat yeniden gönderme
    // yapmayalım; koşullu updateMany aynı anda çalışan iki tik'i de eler.
    const claim = await prisma.subscription.updateMany({
      where: {
        businessId: s.businessId,
        OR: [
          { renewalRemindedFor: null },
          { renewalRemindedFor: { not: son } },
        ],
      },
      data: { renewalRemindedFor: son },
    });
    if (claim.count === 0) continue;

    const kalanGun = Math.max(
      0,
      Math.ceil((son.getTime() - simdi.getTime()) / GUN_MS),
    );
    await notify({
      userId: s.business.owner.id,
      type: "genel",
      title: "Aboneliğin yenilenmeli",
      body: `Dönemin ${trGun(son)} tarihinde doluyor (${kalanGun} gün). Ödemeni yapmazsan profilin keşiften düşer.`,
      href: "/panel/abonelik",
    });

    if (s.business.owner.email) {
      await sendEmail(
        s.business.owner.email,
        `Aboneliğin ${kalanGun} gün içinde doluyor — En Yakın Halı Yıkama`,
        `${s.business.name} aboneliğinin dönemi ${trGun(son)} tarihinde doluyor. Yenilemek için: ${base}/panel/abonelik`,
        wrapEmail(
          `<p>Merhaba,</p>
           <p><strong>${esc(s.business.name)}</strong> aboneliğinin dönemi
           <strong>${trGun(son)}</strong> tarihinde doluyor.</p>
           <p>Ödemen alınmazsa profilin arama sonuçlarından ve keşif sayfalarından
           düşer, müşteriler sana sipariş veremez. Yenilemek için:</p>
           <p><a href="${base}/panel/abonelik">Aboneliği yenile</a></p>
           <p><strong>İpucu:</strong> Kredi kartın varsa <em>düzenli ödeme talimatı</em>
           verebilirsin — her ay otomatik yenilenir, bir daha uğraşmazsın.
           Banka kartıyla talimat verilemiyor (bankalar 3D Secure ister, abonelik
           çekimleri 3D Secure'suzdur); banka kartıyla her ay tek seferlik ödeme
           yapabilirsin.</p>`,
        ),
      ).catch(() => {});
    }
  }

  // ---- 2) Dönemi dolanlar — "yayından düştün" bildirimi ----
  const dolanlar = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL", "PAST_DUE"] },
      currentPeriodEnd: { lt: simdi },
    },
    select: {
      businessId: true,
      currentPeriodEnd: true,
      expiredNotifiedFor: true,
      business: {
        select: { name: true, owner: { select: { id: true, email: true } } },
      },
    },
  });

  for (const s of dolanlar) {
    const son = s.currentPeriodEnd!;
    if (s.expiredNotifiedFor && s.expiredNotifiedFor.getTime() === son.getTime()) {
      continue;
    }
    const claim = await prisma.subscription.updateMany({
      where: {
        businessId: s.businessId,
        OR: [
          { expiredNotifiedFor: null },
          { expiredNotifiedFor: { not: son } },
        ],
      },
      data: { expiredNotifiedFor: son },
    });
    if (claim.count === 0) continue;

    await notify({
      userId: s.business.owner.id,
      type: "genel",
      title: "Aboneliğin doldu — profilin yayında değil",
      body: `Dönemin ${trGun(son)} tarihinde doldu. Ödemeni yapınca profilin anında geri yayına girer.`,
      href: "/panel/abonelik",
    });

    if (s.business.owner.email) {
      await sendEmail(
        s.business.owner.email,
        "Aboneliğin doldu — profilin yayından düştü",
        `${s.business.name} aboneliğinin dönemi ${trGun(son)} tarihinde doldu; profilin yayında değil. Yenilemek için: ${base}/panel/abonelik`,
        wrapEmail(
          `<p>Merhaba,</p>
           <p><strong>${esc(s.business.name)}</strong> aboneliğinin dönemi
           <strong>${trGun(son)}</strong> tarihinde doldu; profilin şu an keşif
           sayfalarında ve aramalarda görünmüyor.</p>
           <p>Ödemeni yaptığın anda profilin geri yayına girer:</p>
           <p><a href="${base}/panel/abonelik">Aboneliği yenile</a></p>`,
        ),
      ).catch(() => {});
    }
  }
}

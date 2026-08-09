import { prisma } from "@/lib/prisma";
import { PLAN, fiyatBasamagi, type Paket } from "@/lib/plan";
import { merdivenAktif } from "@/lib/config";

// KOMİSYON TAHAKKUKU: komisyoncunun getirdiği işletmenin HER başarılı abonelik
// ödemesinde (ilk ödeme + aylık yenileme) KDV HARİÇ net tutar üzerinden,
// admin'in hesap açarken belirlediği yüzdeyle tahakkuk işlenir.
// İDEMPOTENT: CommissionEntry.paymentId @unique — aynı ödemeye ikinci tahakkuk
// yazılamaz (çift callback/webhook replay'inde P2002 → sessiz no-op).
// Best-effort çağrılır: hata ödeme kaydını ASLA geriye döndürmez.

const kurus = (n: number) => Math.round(n * 100) / 100;

export async function accrueCommissionForPayment(paymentId: string): Promise<void> {
  try {
    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        amount: true,
        businessId: true,
        business: {
          select: {
            isDemo: true,
            referredByAgentId: true,
            discountGrantedByAgentId: true,
            // MERDİVENDE "tam fiyat" işletmeye GÖRE değişir (paket + koltuk +
            // kurucu kilidi). İndirim tespiti global sabitle yapılamaz.
            subscription: {
              select: { plan: true, driverSeats: true, priceGrossLocked: true },
            },
            referredByAgent: {
              select: {
                id: true,
                active: true,
                percent: true,
                // BAŞ KOMİSYONCU (2 kademe): alt komisyoncunun başı, havuz
                // farkını alır (havuz - alt yüzdesi).
                parent: {
                  select: { id: true, active: true, poolPercent: true },
                },
              },
            },
          },
        },
      },
    });
    if (!payment || payment.status !== "PAID") return;
    // DEMO İŞLETME KOMİSYON ÜRETMEZ (2026-07-30) — DOĞRUDAN SUİSTİMAL KAPISI.
    // Demo panel komisyoncunun KENDİ kodu/kendi hesabıyla açılıyor; oraya bir
    // ödeme kaydı düşerse (elle, yanlışlıkla ya da kasten) komisyoncu kendi
    // uydurma müşterisinden kendine para yazdırırdı. Ödemenin nasıl oluştuğuna
    // bakmadan burada kesiyoruz: tahakkuk defterine demo satırı GİRMEZ.
    if (payment.business.isDemo) return;
    const agent = payment.business.referredByAgent;
    if (!agent) return;

    const gross = Number(payment.amount);
    if (!Number.isFinite(gross) || gross <= 0) return;

    // PASİF KOMİSYONCU: tahakkuk YOK — ama "atlandı" satırı yazılır. Yoksa ödeme
    // commission:null kalıp saatlik backfill'e takılıyor ve komisyoncu sonradan
    // aktive edildiğinde 90 güne kadar GERİYE DÖNÜK para basılıyordu (inceleme
    // bulgusu: tetik baş komisyoncunun kendi panelindeydi). Kural: pasif geçen
    // dönem KALICI olarak kaybedilir — hem alt hem baş payı için.
    if (!agent.active) {
      await prisma.commissionEntry.create({
        data: {
          agentId: agent.id,
          businessId: payment.businessId,
          paymentId: payment.id,
          grossAmount: gross,
          netAmount: kurus(gross / (1 + PLAN.kdvRate / 100)),
          percent: 0,
          amount: 0,
          skipped: true,
        },
      });
      return;
    }
    // KDV hariç matrah: 2.400 / 1,20 = 2.000 (PLAN.kdvRate tek kaynak).
    const net = kurus(gross / (1 + PLAN.kdvRate / 100));
    const percent = Number(agent.percent);
    if (!Number.isFinite(percent) || percent < 0) return;

    // İNDİRİM PAYLAŞIMI (2026-07-26 kullanıcı kararı): indirimi VEREN komisyoncu
    // indirimin YARISINI kendi komisyonundan karşılar; diğer yarısı platformdan.
    // Örnek: 2.000 net üzerinden %20 indirim = 400 TL kayıp → 200 komisyoncudan,
    // 200 platformdan. Komisyoncu payı bu yüzden İNDİRİMSİZ net üzerinden
    // hesaplanıp yarım indirim düşülerek bulunur. İndirimi admin verdiyse
    // (discountGrantedByAgentId null) komisyoncu cezalandırılmaz.
    // İNDİRİMSİZ MATRAH. Merdiven kapalıyken tek fiyat vardır (2.400) ve hesap
    // 2026-08-09 öncesiyle birebir aynıdır. Merdiven açıkken bu işletmenin KENDİ
    // basamağı esas alınır; global sabit kullanılsaydı FİLO ödemesi "indirimli",
    // VİTRİN'den gelen küçük ödeme ise "tam" görünür, komisyoncu payı yanlış
    // hesaplanırdı. Kurucu kilidi varsa o tutar zaten işletmenin tam fiyatıdır —
    // kurucu bir KAMPANYADIR, komisyoncunun verdiği indirim değildir, o yüzden
    // komisyoncu payından düşülmez.
    const tamBrut = merdivenAktif
      ? Number(
          payment.business.subscription?.priceGrossLocked ??
            fiyatBasamagi(
              (payment.business.subscription?.plan ?? "YONETIM") as Paket,
              Number(payment.business.subscription?.driverSeats ?? 1),
            ).brut,
        )
      : PLAN.priceGrossNumber;
    const netTam = kurus(tamBrut / (1 + PLAN.kdvRate / 100));
    const indirimTutari = Math.max(0, kurus(netTam - net));
    const indirimiVerenBen =
      indirimTutari > 0 &&
      payment.business.discountGrantedByAgentId === agent.id;

    const tutar = indirimiVerenBen
      ? Math.max(0, kurus((netTam * percent) / 100 - indirimTutari / 2))
      : kurus((net * percent) / 100);

    // BAŞ KOMİSYONCU PAYI: havuz payı eksi alt komisyoncunun yüzdesi. Baş
    // pasifse pay işlemez (mevcut "pasif komisyoncuya tahakkuk yok" kuralı).
    // Alt komisyoncuya havuzun TAMAMI verildiyse fark 0 → baş pay almaz.
    const head = agent.parent;
    let headAgentId: string | null = null;
    let headPercent: number | null = null;
    let headAmount: number | null = null;
    if (head && head.active) {
      const havuz = Number(head.poolPercent ?? 0);
      const fark = kurus(havuz - percent);
      if (Number.isFinite(fark) && fark > 0) {
        // İndirimi ALT komisyoncu verdiyse yükü o taşır; baş komisyoncunun payı
        // indirimsiz net üzerinden hesaplanır (baş cezalandırılmaz).
        // Baş kendi verdiyse yukarıdaki "indirimiVerenBen" dalı zaten uygulandı.
        // KURUŞ DEĞİŞMEZİ (inceleme bulgusu): iki payı ayrı ayrı yuvarlamak
        // toplamı havuzun 1 kuruş ÜSTÜNE çıkarabiliyordu. Baş payı, havuzun
        // TAMAMINDAN alt payı çıkarılarak bulunur → toplam asla havuzu aşmaz.
        const esasNet = indirimiVerenBen ? netTam : net;
        const havuzToplam = kurus((esasNet * havuz) / 100);
        // Baş payı iki kuralın KÜÇÜĞÜ:
        //  (a) kendi yüzdesinin karşılığı — alt komisyoncunun indirim yükünü
        //      başa KAZANÇ olarak geçirmemek için (test bulgusu: baş 600 yerine
        //      800 alıyordu, indirimin tamamı platformdan gidiyordu),
        //  (b) havuz toplamı eksi alt payı — toplamın havuzu 1 kuruş bile
        //      aşmasını engelleyen değişmez.
        const headKendi = kurus((esasNet * fark) / 100);
        const headKalan = kurus(havuzToplam - tutar);
        const tutarHead = Math.min(headKendi, headKalan);
        if (tutarHead > 0) {
          headAgentId = head.id;
          headPercent = fark;
          headAmount = tutarHead;
        }
      }
    }

    // İkisi de sıfırsa yazacak bir şey yok (ör. yüzde 0 + baş yok/pasif).
    if (tutar <= 0 && headAmount == null) return;

    await prisma.commissionEntry.create({
      data: {
        agentId: agent.id,
        businessId: payment.businessId,
        paymentId: payment.id,
        grossAmount: gross,
        netAmount: net,
        percent,
        amount: tutar,
        headAgentId,
        headPercent,
        headAmount,
      },
    });
  } catch (e) {
    // P2002 = bu ödemeye tahakkuk zaten işlendi (çift callback) → normal no-op.
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return;
    }
    console.error("komisyon tahakkuku:", e);
  }
}


/** GÜVENLİK AĞI: komisyoncusu olan işletmelerin son 90 gündeki PAID ödemeleri
 *  içinde tahakkuku EKSİK kalanları tarar ve işler (accrue geçici bir hatayla
 *  yutulmuşsa komisyon kaybolmasın). Saatlik tik'ten çağrılır; idempotent. */
export async function backfillMissingCommissions(): Promise<void> {
  try {
    const eksikler = await prisma.subscriptionPayment.findMany({
      where: {
        status: "PAID",
        // 0 TL'lik ücretsiz-dönem kayıtları hariç: tahakkuk üretmezler ama
        // "commission: null" kaldıkları için take:50 penceresini tıkarlardı.
        amount: { gt: 0 },
        paidAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        commission: null,
        // Demo işletme tahakkuk üretmez (accrue zaten kesiyor); pencereyi de
        // tıkamasın diye burada baştan eleniyor.
        business: { isDemo: false, referredByAgentId: { not: null } },
      },
      select: { id: true },
      take: 50,
    });
    for (const p of eksikler) await accrueCommissionForPayment(p.id);
  } catch (e) {
    console.error("komisyon-backfill:", e);
  }
}

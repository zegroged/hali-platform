import { prisma } from "@/lib/prisma";

// KOMİSYON ÖDEMESİ (çekim) yardımcıları — 2026-07-26.
// Komisyoncunun bakiyesi = ödenmemiş KENDİ payları + (baş komisyoncuysa)
// ödenmemiş HAVUZ FARKI payları. "skipped" satırları (pasif dönem) sayılmaz.

const kurus = (n: number) => Math.round(n * 100) / 100;

export async function agentBalance(agentId: string): Promise<{
  kendi: number;
  havuz: number;
  toplam: number;
}> {
  const [kendiAgg, havuzAgg] = await Promise.all([
    prisma.commissionEntry.aggregate({
      where: { agentId, skipped: false, paidAt: null },
      _sum: { amount: true },
    }),
    prisma.commissionEntry.aggregate({
      where: { headAgentId: agentId, skipped: false, headPaidAt: null },
      _sum: { headAmount: true },
    }),
  ]);
  const kendi = kurus(Number(kendiAgg._sum.amount ?? 0));
  const havuz = kurus(Number(havuzAgg._sum.headAmount ?? 0));
  return { kendi, havuz, toplam: kurus(kendi + havuz) };
}

/** Ödeme yapıldı: TALEP TARİHİNE KADARKİ ödenmemiş tahakkukları kapat ve
 *  talebi PAID işaretle. Talepten SONRA gelen tahakkuk kapanmaz — bir sonraki
 *  ay-sonu talebine kalır (ekranda görünen = havale edilen = kayda yazılan).
 *  Tek transaction: yarım kapanma olmaz. */
export async function markPayoutPaid(
  requestId: string,
  adminNote?: string,
): Promise<{
  ok: boolean;
  tutar?: number;
  stopaj?: number;
  net?: number;
  hata?: string;
}> {
  const istek = await prisma.payoutRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      agentId: true,
      status: true,
      createdAt: true,
      agent: { select: { faturaMukellefi: true, taxId: true, address: true } },
    },
  });
  if (!istek) return { ok: false, hata: "Talep bulunamadı." };
  if (istek.status !== "PENDING")
    return { ok: false, hata: "Bu talep zaten kapatılmış." };

  const simdi = new Date();

  // 🔴 KAPATMA TALEP ANINA SABİTLENİR (2026-08-01 düşman denetimi, KRİTİK):
  // önceden "o ana kadarki TÜM ödenmemişler" kapanıyordu — talep açıldıktan
  // SONRA gelen tahakkuk da sessizce kapanıyor, admin ekranda t.amount görüp
  // ona göre havale ederken kayıt bakiye.toplam ile yazılıyordu: komisyoncuya
  // eksik havale + yanlış muhtasar. Artık yalnız talep tarihinden ÖNCE oluşmuş
  // satırlar kapanır; sonra gelenler bir SONRAKİ ay-sonu talebine kalır.
  const kapatmaFiltre = {
    skipped: false,
    createdAt: { lte: istek.createdAt },
  } as const;
  const [altAgg, headAgg] = await Promise.all([
    prisma.commissionEntry.aggregate({
      where: { ...kapatmaFiltre, agentId: istek.agentId, paidAt: null },
      _sum: { amount: true },
    }),
    prisma.commissionEntry.aggregate({
      where: { ...kapatmaFiltre, headAgentId: istek.agentId, headPaidAt: null },
      _sum: { headAmount: true },
    }),
  ]);
  const odenecek =
    Math.round(
      (Number(altAgg._sum.amount ?? 0) + Number(headAgg._sum.headAmount ?? 0)) *
        100,
    ) / 100;
  if (odenecek <= 0)
    return { ok: false, hata: "Bu talebin kapsamında ödenmemiş tahakkuk kalmamış." };

  // STOPAJ — OTOMATİK (2026-07-31 kullanıcı kararı). Eşik, TALEBİN AÇILDIĞI
  // AYIN tahakkukuna göre ölçülür (denetim, KRİTİK): 31 Temmuz'da açılan talep
  // 2 Ağustos'ta ödendiğinde önceki kod YENİ ayın (~0) toplamına bakıp stopajı
  // tamamen atlıyordu. Kesinti kaydı talebe KALICI yazılır; mükellefe stopaj
  // uygulanmaz (fatura keser, brüt ödenir).
  let stopajOran: number | null = null;
  let stopajTutar: number | null = null;
  let netTutar: number | null = null;
  if (!istek.agent.faturaMukellefi) {
    const { ayTahakkuklari, stopajHesapla, STOPAJ_ESIK, STOPAJ_ORAN } =
      await import("@/lib/stopaj");
    const ayToplam =
      (await ayTahakkuklari([istek.agentId], istek.createdAt)).get(
        istek.agentId,
      ) ?? 0;
    if (ayToplam >= STOPAJ_ESIK) {
      const d = stopajHesapla(odenecek);
      stopajOran = STOPAJ_ORAN * 100;
      stopajTutar = d.stopaj;
      netTutar = d.net;
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // KOŞULLU claim (TOCTOU): yalnız hâlâ PENDING olan talebi kapat.
      const claim = await tx.payoutRequest.updateMany({
        where: { id: istek.id, status: "PENDING" },
        data: {
          status: "PAID",
          paidAt: simdi,
          paidAmount: odenecek,
          mukellefti: istek.agent.faturaMukellefi,
          stopajOran,
          stopajTutar,
          netTutar,
          // Stopajlı ödemede kimlik/adres eksikse iz düşür (denetim: eksik
          // belgeli pusula sessizce akıyordu) — ödeme ENGELLENMEZ (para
          // bekletmek daha kötü) ama eksik, kayıtta ve dökümde görünür olur.
          adminNote:
            [
              adminNote?.trim() || null,
              stopajTutar != null && (!istek.agent.taxId || !istek.agent.address)
                ? "⚠️ pusula eksik: " +
                  [!istek.agent.taxId && "TCKN", !istek.agent.address && "adres"]
                    .filter(Boolean)
                    .join("+")
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || null,
        },
      });
      if (claim.count === 0) throw new Error("zaten-kapali");
      await tx.commissionEntry.updateMany({
        where: { ...kapatmaFiltre, agentId: istek.agentId, paidAt: null },
        data: { paidAt: simdi },
      });
      await tx.commissionEntry.updateMany({
        where: { ...kapatmaFiltre, headAgentId: istek.agentId, headPaidAt: null },
        data: { headPaidAt: simdi },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "zaten-kapali")
      return { ok: false, hata: "Bu talep az önce kapatıldı." };
    throw e;
  }
  return {
    ok: true,
    tutar: odenecek,
    stopaj: stopajTutar ?? undefined,
    net: netTutar ?? undefined,
  };
}

/** AYLIK OTOMATİK TALEP: komisyoncu "her ayın X'i" seçtiyse o gün bakiyesi
 *  varsa talep kendiliğinden oluşur (admin panelinde görünür). Ay başına TEK
 *  kez: aynı ay içinde talep varsa atlanır. Saatlik tik'ten çağrılır. */
// AY SONU TOPLU ÖDEME (2026-07-31, kullanıcı kararı: "ödemeleri her ayın
// sonuna indirgeyelim, herkes her ay düzenli alsın").
// Eski model: her komisyoncu kendi gününü seçer + istediği an elle talep açar
// → admin'e dağınık, öngörüsüz iş. Yeni model: ayın SON GÜNÜ (TR takvimi)
// bakiyesi olan HERKESE otomatik talep açılır; admin ay sonunda TEK toplu
// listeyle havaleleri yapar (stopaj zaten otomatik hesaplanıp yazılıyor).
// Elle talep butonu ve kişisel gün seçimi KALDIRILDI (Agent.payoutDay artık
// okunmuyor — kolon eski kayıtlar için duruyor).
export async function createScheduledPayoutRequests(): Promise<void> {
  const simdi = new Date();
  // TR takvim günü — konteyner UTC'de; gece yarısı sınırında yanlış gün olmasın.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
  })
    .format(simdi)
    .split("-")
    .map(Number);
  const sonGun = new Date(y, m, 0).getDate(); // m: 1-12 → o ayın son günü
  if (d !== sonGun) return;

  // Ay başına TEK koşu — DEVRALINABİLİR marker (denetim bulgusu: marker işten
  // ÖNCE yazılıp koşu ortasında konteyner ölürse kalan komisyoncular o ay
  // atlanıyordu; yeniden koşmak zaten güvenli — tek-bekleyen kontrolü açılmış
  // talebi atlar). Değer "basladi:<ts>" ile başlar, iş bitince "bitti:<ts>"
  // olur; "basladi" hâlinde 1 saatten eski marker CAS ile devralınır.
  const anahtar = `payout-ay-${y}-${String(m).padStart(2, "0")}`;
  const damga = `basladi:${Date.now()}`;
  const kilit = await prisma.appState.createMany({
    data: [{ key: anahtar, value: damga }],
    skipDuplicates: true,
  });
  let benimDamgam = damga;
  if (kilit.count === 0) {
    const eski = await prisma.appState.findUnique({ where: { key: anahtar } });
    if (!eski || eski.value.startsWith("bitti:")) return; // bu ay tamamlandı
    const yas = Date.now() - Number(eski.value.split(":")[1] || 0);
    if (yas < 60 * 60 * 1000) return; // koşu sürüyor (ya da az önce başladı)
    // Yarım kalmış koşu: CAS ile devral (iki tik aynı anda devralamaz).
    const devral = await prisma.appState.updateMany({
      where: { key: anahtar, value: eski.value },
      data: { value: damga },
    });
    if (devral.count === 0) return;
  }

  const agents = await prisma.agent.findMany({
    where: { active: true },
    select: { id: true, userId: true, iban: true, ibanName: true },
  });
  for (const a of agents) {
    const bekleyen = await prisma.payoutRequest.count({
      where: { agentId: a.id, status: "PENDING" },
    });
    if (bekleyen > 0) continue; // zaten açık talep var (tek-bekleyen kuralı)
    const bakiye = await agentBalance(a.id);
    if (bakiye.toplam <= 0) continue;
    if (!a.iban || !a.ibanName) {
      // Bakiye var ama havale bilgisi eksik: talep AÇILMAZ (admin IBAN'sız
      // havale yapamaz), komisyoncuya zil çalar — ekleyince gelecek ay girer.
      try {
        const { notify } = await import("@/lib/notify");
        await notify({
          userId: a.userId,
          type: "genel",
          title: "Ay sonu ödemen bekletildi",
          body: `${bakiye.toplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL bakiyen var ama IBAN/hesap sahibi adı eksik. Panelindeki "Ödemem" bölümünden ekle — bir sonraki ay sonunda otomatik ödenir.`,
          href: "/komisyoncu",
        });
      } catch (e) {
        console.error("[ay-sonu-odeme] zil hatası:", e);
      }
      continue;
    }
    await prisma.payoutRequest.create({
      data: {
        agentId: a.id,
        amount: bakiye.toplam,
        iban: a.iban,
        ibanName: a.ibanName,
        auto: true,
        note: "Ay sonu otomatik ödeme",
      },
    });
  }
  // İş bitti: marker'ı kalıcıla — yalnız kendi damgamızla (devralma yarışı).
  await prisma.appState.updateMany({
    where: { key: anahtar, value: benimDamgam },
    data: { value: `bitti:${Date.now()}` },
  });
}

// Sunucu açılışında bir kez çalışır (Next.js instrumentation hook).
// KVKK saklama süresi temizliği: gizlilik politikası ve şoför aydınlatması
// 12 ayı aşan konum/durak kayıtlarının silineceğini taahhüt eder — zamanlaması
// burada, gövdesi lib/retention.ts'te.

const DAY_MS = 24 * 60 * 60 * 1000;

async function purgeOldLocationData() {
  // Gövde lib/retention.ts'te (parçalı silme + durak kayıtları). Buradan yalnız
  // çağrılır: bu dosya zamanlayıcı kalsın, iş mantığı kütüphanede dursun.
  // Dinamik import: prisma instrumentation edge bundle'ına sızmasın.
  await (await import("@/lib/retention")).purgeExpiredLocationData();
}

async function hourlyTick() {
  try {
    const { maybeSendWeeklyDigest } = await import("@/lib/weeklyDigest");
    await maybeSendWeeklyDigest();
  } catch (e) {
    console.error("[haftalik-ozet] hata:", e);
  }
  try {
    const { checkStaleOrders } = await import("@/lib/orderSla");
    await checkStaleOrders();
  } catch (e) {
    console.error("[siparis-sla] hata:", e);
  }
  try {
    const { backfillMissingCommissions } = await import("@/lib/commission");
    await backfillMissingCommissions();
  } catch (e) {
    console.error("[komisyon-backfill] hata:", e);
  }
  try {
    // Elle ödeyenlere yenileme hatırlatması / dönemi dolana bildirim.
    const { checkSubscriptionRenewals } = await import(
      "@/lib/subscriptionReminder"
    );
    await checkSubscriptionRenewals();
  } catch (e) {
    console.error("[abonelik-hatirlatma] hata:", e);
  }
  try {
    // Komisyoncunun seçtiği günde aylık otomatik ödeme talebi oluştur.
    const { createScheduledPayoutRequests } = await import("@/lib/payout");
    await createScheduledPayoutRequests();
  } catch (e) {
    console.error("[odeme-talebi] hata:", e);
  }
  try {
    // Kasa: tekrarlayan gider/gelir kalemlerini vadesinde oluştur.
    const { runLedgerRecurrences } = await import("@/lib/ledger");
    await runLedgerRecurrences();
  } catch (e) {
    console.error("[kasa-tekrar] hata:", e);
  }
  try {
    await dailyTick();
  } catch (e) {
    console.error("[gunluk-tik] hata:", e);
  }
}

const DAILY_STATE_KEY = "dailyTickDay";

/**
 * GÜNLÜK tik — saatlik tikin içinden çağrılır, TR takvim günü değiştiyse çalışır.
 *
 * NEDEN AppState işareti: konteyner gün içinde birkaç kez yeniden başlıyor
 * (deploy, OOM). "Açılışta bir kez + 24 saatlik interval" deseni kullanılsaydı
 * aynı gün İKİ KEZ çalışır, müşteriye iki kez yazardı.
 *
 * NEDEN upsert DEĞİL: açılışta hourlyTick İKİ KEZ tetikleniyor (hemen + 30 sn),
 * "önce oku, yoksa yaz" arasında ikisi de boş okuyup ikisi de çalışabilirdi.
 * Tek UPDATE ... WHERE value <> bugün atomiktir: yarışı yalnız biri kazanır.
 */
async function dailyTick() {
  const { prisma } = await import("@/lib/prisma");
  const { bugunISO } = await import("@/lib/tahsilat");
  const bugun = bugunISO(new Date());

  const guncellenen = await prisma.appState.updateMany({
    where: { key: DAILY_STATE_KEY, value: { not: bugun } },
    data: { value: bugun },
  });
  if (guncellenen.count === 0) {
    // Ya kayıt hiç yok (ilk çalışma) ya da bugün zaten çalıştı. Anahtar birincil
    // anahtar olduğundan create çakışırsa ikincisidir → sessizce çık.
    const olusturuldu = await prisma.appState
      .create({ data: { key: DAILY_STATE_KEY, value: bugun } })
      .catch(() => null);
    if (!olusturuldu) return;
  }

  try {
    // Sezon hatırlatması — SEZON_HATIRLATMA=1 değilse fonksiyon hemen döner.
    const { sendSeasonReminders } = await import("@/lib/seasonReminder");
    await sendSeasonReminders();
  } catch (e) {
    console.error("[sezon-hatirlatma] hata:", e);
  }
}

export async function register() {
  // Yalnız Node.js runtime'ında (edge/middleware derlemesinde prisma yok).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Açılışta bir kez + günde bir. unref: interval, kapanışı bloklamasın.
  await purgeOldLocationData();
  const timer = setInterval(purgeOldLocationData, DAY_MS);
  if (typeof timer.unref === "function") timer.unref();
  // Saatlik tik: haftalık özet (yalnız TR pazartesi, AppState işaretli) +
  // sipariş SLA bekçisi (2s hatırlatma / 24s eskalasyon; sipariş başına bir kez)
  // + GÜNLÜK tik (sezon hatırlatması; TR günü başına bir kez, AppState işaretli).
  // await ETME: birikmiş iş (e-posta döngüsü) açılışı bloklamasın — kesinti
  // sonrası site bir an önce ayağa kalkmalı.
  void hourlyTick();
  const hourlyTimer = setInterval(hourlyTick, 60 * 60 * 1000);
  // Açılışta da bir kez (30 sn sonra): deploy sonrası SLA/komisyon-backfill
  // taraması bir saat beklemesin.
  setTimeout(hourlyTick, 30_000);
  if (typeof hourlyTimer.unref === "function") hourlyTimer.unref();
}

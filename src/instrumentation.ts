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

  // WhatsApp medyası: 1 ay saklama + başarısız indirmelerin yeniden denenmesi
  // (2026-08-07 akşam). Saatlik tikte; ikisi de parça parça çalışır.
  try {
    const r = await import("@/lib/retention");
    await r.purgeWhatsAppMedia();
    await r.retryWhatsAppMedia();
  } catch (e) {
    console.error("[tik] wa medya bakımı hatası:", e);
  }
}

async function hourlyTick() {
  try {
    const { maybeSendWeeklyDigest } = await import("@/lib/weeklyDigest");
    await maybeSendWeeklyDigest();
  } catch (e) {
    console.error("[haftalik-ozet] hata:", e);
  }
  try {
    const { checkStaleOrders, remindUnapprovedPrices } = await import(
      "@/lib/orderSla"
    );
    await checkStaleOrders();
    // Kesin fiyatı onaylanmayan siparişler: 3 saat sessizlikte tek hatırlatma
    // (2026-08-07 akşam — "ya müşteri yazmazsa?").
    await remindUnapprovedPrices();
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

/**
 * KONUM BEKÇİSİ TİKİ — saatlik tik bu iş için ÇOK YAVAŞ.
 *
 * Sahada ölçülen ölüm süresi ~6,5 dakika (2026-08-08); saatte bir bakan bir
 * bekçi şoförü 50+ dakika kör bırakırdı. 5 dakika, 10 dakikalık sessizlik
 * eşiğiyle birlikte en geç ~15 dakikada haber verir.
 *
 * Maliyeti düşük: mesaide şoför yoksa tek sorguda çıkar.
 */
async function konumTick() {
  try {
    const { konumsuzMesaiKontrol } = await import("@/lib/konumBekcisi");
    await konumsuzMesaiKontrol();
  } catch (e) {
    console.error("[konum-bekcisi] hata:", e);
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
    // Ya kayıt hiç yok (ilk çalışma) ya da bugün zaten çalıştı.
    // createMany + skipDuplicates: create/catch ile aynı yarış güvenliği ama
    // ÇAKIŞMADA İSTİSNA FIRLATMIYOR. Öncekinde Prisma her açılışta konteyner
    // loguna "prisma:error ... Unique constraint failed on the fields: (key)"
    // basıyordu; akış doğruydu ama log gürültüsü gerçek hataları maskeliyordu
    // (2026-07-30 deploy doğrulamasında görüldü).
    const { count } = await prisma.appState.createMany({
      data: [{ key: DAILY_STATE_KEY, value: bugun }],
      skipDuplicates: true,
    });
    if (count === 0) return; // kayıt zaten vardı → bugün çalışmış
  }

  try {
    // HAK EDİLEN ROZETLER (2026-08-03): gece gerçek veriden yeniden hesaplanır.
    // Şartı sağlamayan rozet SİLİNİR — rozet güncel durumu gösterir, geçmişte
    // kazanılmış madalya değildir. Elle verilen VERIFIED'e dokunulmaz.
    const { rozetleriYenidenHesapla } = await import("@/lib/badgeCompute");
    const r = await rozetleriYenidenHesapla();
    console.log(
      `[rozet] ${r.isletme} işletme tarandı · ${r.verilen} rozet güncel · ${r.kaldirilan} kaldırıldı`,
    );
  } catch (e) {
    console.error("[rozet] hata:", e);
  }

  try {
    // Sezon hatırlatması — ayar VERİTABANINDA (AppState, /admin/hatirlatma).
    // Admin açmadıysa fonksiyon hemen döner; elle tetikleme admin ekranından.
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
  // await ETME (2026-07-30, 4.43 bulgusu): birikmiş KVKK temizliği (365 günü
  // aşan konum kayıtları) açılışı dakikalarca bloklayabilir — kesinti sonrası
  // site önce ayağa kalkmalı. purge kendi hatasını içerde yutuyor.
  void purgeOldLocationData().catch((e) =>
    console.error("[kvkk-temizlik] açılış hatası:", e),
  );
  // setInterval'a async fonksiyonu CIPLAK verme: reddedilen soz unhandled
  // rejection olur (acilis cagrisi .catch'liydi, periyodik olan degildi).
  const timer = setInterval(
    () =>
      void purgeOldLocationData().catch((e) =>
        console.error("[kvkk-temizlik] periyodik hata:", e),
      ),
    DAY_MS,
  );
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

  // Konum bekçisi: 5 dakikada bir (gerekçe konumTick'in başında).
  // Açılıştan 60 sn sonra da bir kez: interval sayacı her yeniden başlatmada
  // sıfırlanır, yoğun deploy günlerinde (bu projede 12 deploy'luk gün oldu)
  // kontrol hiç çalışmadan konteyner yenilenebilirdi.
  setTimeout(konumTick, 60_000);
  const konumTimer = setInterval(konumTick, 5 * 60 * 1000);
  if (typeof konumTimer.unref === "function") konumTimer.unref();
}

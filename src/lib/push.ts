import { prisma } from "@/lib/prisma";

// TELEFON BİLDİRİMİ (Expo Push, 2026-08-05).
//
// Expo'nun push servisi tek bir HTTP ucundan çalışır; SDK gerekmez. Jetonları
// biz saklıyoruz (PushToken), gönderimi Expo yapıyor, o da Android tarafında
// FCM'e devrediyor.
//
// ⚠️ FCM ŞART: Android'de bu zincir ancak projede `google-services.json` varsa
// ve EAS'te FCM anahtarı tanımlıysa çalışır. Yoksa Expo isteği KABUL EDER ama
// telefona hiçbir şey düşmez — yani sessizce kaybolur. Bu yüzden aşağıda
// Expo'nun döndürdüğü her "error" durumu log'a yazılıyor; sessiz kalma yok.
//
// Tamamen best-effort: push gönderilemezse hiçbir iş akışı bozulmaz. Uygulama
// içi zil (Notification tablosu) her hâlükârda yazılır — push onun üstüne
// eklenen bir katmandır, yerine geçen değil.

const EXPO_UC = "https://exp.host/--/api/v2/push/send";

type Mesaj = {
  to: string;
  /** SESSİZ UYANDIRMADA YOK (2026-08-10): `title`/`body` verilmezse Android'de
   *  bildirim GÖRÜNMEZ, yalnız `data` düşer. Görünür bildirimlerde zorunlu
   *  gibi davranılır — `pushGonder` her zaman doldurur. */
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default";
  channelId?: string;
  /** Doze/uygulama-uykusu altında da teslim edilsin (uyandırma bildirimi
   *  geciktiğinde işe yaramaz — 2026-08-10). */
  priority?: "high" | "normal";
};

/** Expo'nun jeton biçimi. Bozuk kayıt servise hiç gitmesin. */
function gecerliJeton(t: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t);
}

/**
 * SESSİZ UYANDIRMA (2026-08-10) — ekranda HİÇBİR ŞEY göstermeden uygulamayı
 * dürter, yalnız veri taşır.
 *
 * NEDEN AYRI: bugüne kadar uyandırma ile "şoförü uyar" AYNI bildirimdi ve
 * aynı freni paylaşıyorlardı (10 dk sessizlik + 60 dk tekrar freni). Yani
 * ilk uyandırma tutmazsa bir SONRAKİ deneme 60 dakika sonraydı — canlıda
 * ölçülen 109 ve 114 dakikalık deliklerin sebebi buydu (§4.87-B).
 * İki işin takvimi ayrı olmalı: insanı uyarmak seyrek ve frenli, uygulamayı
 * diriltmek sık ve bedava.
 *
 * `title`/`body` YOK → Android'de bildirim GÖRÜNMEZ, yalnız `data` düşer.
 * Şoför 45 saniyede bir bildirim yağmuruna tutulmaz.
 *
 * ⚠️ DÜRÜST SINIR: ROM süreci TAMAMEN öldürdüyse (force-stop) hiçbir push
 * uyandıramaz. Bu bir olasılık artırıcıdır, garanti değil.
 */
export async function pushSessizUyandir(userId: string): Promise<void> {
  let jetonlar: { token: string }[] = [];
  try {
    jetonlar = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
  } catch (e) {
    console.error("[push:sessiz] jetonlar okunamadı:", e);
    return;
  }
  const hedefler = jetonlar.map((j) => j.token).filter(gecerliJeton);
  if (hedefler.length === 0) return;

  const mesajlar: Mesaj[] = hedefler.map((to) => ({
    to,
    // title/body BİLEREK YOK — veri-push.
    data: { tip: "konum-yeniden-baslat", sessiz: "1" },
    priority: "high",
  }));

  try {
    const res = await fetch(EXPO_UC, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(mesajlar),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[push:sessiz] reddedildi HTTP ${res.status}`);
    }
  } catch (e) {
    console.error("[push:sessiz] gönderilemedi:", e);
  }
}

/**
 * Bir kullanıcının TÜM cihazlarına bildirim gönder.
 * Hata fırlatmaz; çağıran akışı asla durdurmaz.
 */
export async function pushGonder(
  userId: string,
  title: string,
  body?: string,
  href?: string,
  /** Uygulamanın DAVRANIŞ ÜRETMESİ için ek veri (ör. konum akışını yeniden
   *  başlat). Görünen bildirimin yanında taşınır; uygulama açıksa arka planda
   *  işlenir, kapalıysa şoför dokununca uygulanır. */
  ekstra?: Record<string, string>,
): Promise<void> {
  let jetonlar: { token: string }[] = [];
  try {
    jetonlar = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
  } catch (e) {
    console.error("[push] jetonlar okunamadı:", e);
    return;
  }
  const hedefler = jetonlar.map((j) => j.token).filter(gecerliJeton);
  if (hedefler.length === 0) return;

  const mesajlar: Mesaj[] = hedefler.map((to) => ({
    to,
    title,
    body,
    sound: "default",
    // Android'de bildirim kanalı: uygulama tarafında aynı adla kuruluyor.
    channelId: "default",
    // ÖNCELİK YÜKSEK: Doze/uygulama-uykusu altında da teslim edilsin —
    // konum akışı kesildiğinde gönderdiğimiz uyandırma bildirimi gecikirse
    // işe yaramaz (2026-08-10).
    priority: "high",
    data:
      href || ekstra ? { ...(href ? { href } : {}), ...(ekstra ?? {}) } : undefined,
  }));

  try {
    const res = await fetch(EXPO_UC, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(mesajlar),
      // Bildirim için sipariş akışı beklemesin.
      signal: AbortSignal.timeout(10000),
    });
    const cevap = (await res.json().catch(() => null)) as {
      data?: { status?: string; message?: string; details?: { error?: string } }[];
      errors?: unknown;
    } | null;

    if (!res.ok || cevap?.errors) {
      console.error(
        `[push] gönderim reddedildi HTTP ${res.status}:`,
        JSON.stringify(cevap?.errors ?? cevap).slice(0, 400),
      );
      return;
    }

    // ÖLÜ JETON TEMİZLİĞİ: kullanıcı uygulamayı sildiğinde jeton geçersizleşir.
    // Expo bunu `DeviceNotRegistered` ile bildirir; kaydı silmezsek her
    // bildirimde boşuna denenir ve log şişer.
    const olu: string[] = [];
    (cevap?.data ?? []).forEach((sonuc, i) => {
      if (sonuc?.status === "error") {
        const kod = sonuc.details?.error ?? "";
        console.error(
          `[push] jeton hatası (${kod}): ${sonuc.message ?? ""} — ${hedefler[i]}`,
        );
        if (kod === "DeviceNotRegistered") olu.push(hedefler[i]);
      }
    });
    if (olu.length) {
      await prisma.pushToken
        .deleteMany({ where: { token: { in: olu } } })
        .catch(() => {});
    }
  } catch (e) {
    console.error("[push] gönderilemedi:", e);
  }
}

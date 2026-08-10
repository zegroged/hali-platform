import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// KONUM BEKÇİSİ — "mesai açık ama konum gelmiyor" hâlini GÖRÜNÜR yapar.
//
// NEDEN VAR (2026-08-08, sahada ölçüldü): işletme sahibi mesaiyi açtı, 1-3 dk
// uygulamada kaldı, çıktı. Konum akışı ~6,5 dakika sonra telefon tarafından
// öldürüldü (Tecno/HiOS agresif arka plan yönetimi) ve İKİ SAAT boyunca kimse
// fark etmedi. Panelde yalnız "aktif değil" yazıyordu — sebebini söylemiyordu,
// şoför de "mesaideyim" sanıyordu.
//
// 🔑 Bu, projenin kronik hastalığının (sessiz başarısızlık) konum tarafındaki
// hâli. Kural: bir akışın ÖLDÜĞÜNÜ kullanıcı EKRANDAN görebilmeli.
//
// ⚠️ Bu bekçi sorunu ÇÖZMEZ, GÖRÜNÜR KILAR. Telefonun servisi öldürmesi ayrı
// bir iş (pil optimizasyonu muafiyeti + otomatik başlatma akışı, §5-B).
// Bekçi markadan bağımsız çalışır ve o iş tutmasa bile kör kalmamızı önler.

/** Bu kadar dakikadır ping yoksa akış ölü sayılır.
 *  Uygulama hareketsizken bile 60 sn'de bir kalp atışı gönderir (tracking.ts),
 *  yani 10 dakika = 10 kaçmış atış. Geçici şebeke kesintisine takılmaz. */
const SESSIZLIK_DK = 10;

/** Ölü hâl sürerken aynı şoför için uyarılar arası en az bu kadar dakika. */
const TEKRAR_DK = 60;

/** Bundan uzun sessizlik "akış öldü" değil, KAPATILMAYI UNUTULMUŞ MESAİDİR.
 *
 *  2026-08-08 ölçümü: canlıda 5 şoförün mesaisi açık kalmıştı — biri 22
 *  Temmuz'dan beri. Bu eşik olmadan bekçi ilk tikte hepsine (ve işletme
 *  sahiplerine) uyarı yağdırır, üstelik saat başı tekrarlar. Onlarınki ayrı
 *  bir sorun: mesai gün sonunda otomatik kapanmıyor (§5-B'ye eklendi). */
const TERK_DK = 12 * 60;

const anahtar = (driverId: string) => `konum-uyari-${driverId}`;

/** Uyarı işaretini siler (mesai açılış/kapanışında ve akış düzelince). */
export async function konumUyariIsaretiniSil(driverId: string): Promise<void> {
  await prisma.appState
    .delete({ where: { key: anahtar(driverId) } })
    .catch(() => {}); // yoksa sorun değil
}

export async function konumsuzMesaiKontrol(): Promise<void> {
  const soforler = await prisma.driver.findMany({
    // `shiftStartedAt` ŞART: damgası olmayan mesai, bu alan eklenmeden ÖNCE
    // açılmış (ya da haftalardır kapatılmamış) demektir — ne zamandır sessiz
    // olduğunu bilemeyiz. Bekçi ilk çalıştığında canlıda böyle 5 mesai vardı
    // (biri 22 Temmuz'dan beri); damga şartı olmasa hepsine ve işletme
    // sahiplerine uyarı yağardı. Mesai kapanıp yeniden açılınca damga oluşur
    // ve şoför kendiliğinden kapsama girer.
    where: { isOnShift: true, shiftStartedAt: { not: null } },
    select: {
      id: true,
      userId: true,
      shiftStartedAt: true,
      user: { select: { name: true } },
      business: { select: { name: true, ownerId: true } },
    },
  });
  if (soforler.length === 0) return;

  // Tek sorguda hepsinin son ping'i (şoför başına ayrı sorgu atmayalım).
  const sonPingler = await prisma.driverLocationPing.groupBy({
    by: ["driverId"],
    where: { driverId: { in: soforler.map((s) => s.id) } },
    _max: { recordedAt: true },
  });
  const sonPing = new Map(
    sonPingler.map((p) => [p.driverId, p._max.recordedAt?.getTime() ?? 0]),
  );

  const simdi = Date.now();

  for (const s of soforler) {
    // Referans = en son ping YA DA mesai açılışı; hangisi yeniyse.
    // Mesai açılışını da saymak şart: "hiç ping gelmedi" durumunda son ping
    // yoktur ve yalnız ping'e bakan bir bekçi bu hâli HİÇ göremezdi — oysa
    // yakalamak istediğimiz asıl vaka budur.
    const referans = Math.max(
      sonPing.get(s.id) ?? 0,
      s.shiftStartedAt?.getTime() ?? 0,
    );
    // Ne ping ne açılış damgası var: bu kayıt yeni alandan önce açılmış bir
    // mesai. Ne kadar süredir sessiz olduğunu bilemeyiz — uydurmak yerine
    // atlıyoruz; mesai kapanıp yeniden açılınca damga oluşur.
    if (referans === 0) continue;

    const sessizDk = Math.floor((simdi - referans) / 60_000);
    const isaret = await prisma.appState.findUnique({
      where: { key: anahtar(s.id) },
    });

    // — AKIŞ SAĞLIKLI —
    if (sessizDk < SESSIZLIK_DK) {
      if (isaret) {
        // Daha önce uyarmıştık, şimdi düzeldi: döngüyü kapat. Sessizce
        // silmek yetmez — uyarıyı alan iki kişi de düzeldiğini bilmeli,
        // yoksa "hâlâ bozuk mu?" diye tahmin ederler.
        const ad = s.user.name || "Şoför";
        await notify({
          userId: s.userId,
          type: "genel",
          title: "Konum akışı düzeldi",
          body: "Konumun yeniden işletmene iletiliyor.",
          href: "/sofor",
        });
        if (s.business.ownerId) {
          await notify({
            userId: s.business.ownerId,
            type: "genel",
            title: "Şoförün konumu yeniden geliyor",
            body: `${ad} için konum akışı düzeldi — haritada yeniden görebilirsin.`,
            href: "/panel/takip",
          });
        }
        await konumUyariIsaretiniSil(s.id);
      }
      continue;
    }

    // — TERK EDİLMİŞ MESAİ — uyarma, yalnız iz bırak (gerekçe TERK_DK'da).
    if (sessizDk > TERK_DK) {
      console.warn(
        `[konum-bekcisi] TERK EDİLMİŞ MESAİ (uyarı gönderilmedi) sofor=${s.id} isletme="${s.business.name}" sessiz=${Math.floor(sessizDk / 60)}sa`,
      );
      continue;
    }

    // — AKIŞ ÖLÜ —
    if (isaret) {
      const oncekiUyari = Date.parse(isaret.value);
      if (
        Number.isFinite(oncekiUyari) &&
        simdi - oncekiUyari < TEKRAR_DK * 60_000
      ) {
        continue; // yakında uyardık; her tikte zil çalmayalım
      }
    }

    const ad = s.user.name || "Şoför";
    const hicGelmedi = (sonPing.get(s.id) ?? 0) === 0;

    // ŞOFÖRE — ne yapacağını SÖYLE, sadece "hata var" deme.
    await notify({
      userId: s.userId,
      type: "genel",
      title: "⚠️ Konumun gitmiyor",
      body:
        `Mesain açık görünüyor ama ${sessizDk} dakikadır konum gönderilmiyor. ` +
        `Uygulamayı aç, mesaiyi kapatıp yeniden aç. Tekrarlıyorsa telefonun ` +
        `pil ayarlarından "Halı Şoför" uygulamasını kısıtlamadan çıkar.`,
      href: "/sofor",
      // UYANDIRMA (2026-08-10): bildirimin tek işi haber vermek değil, konum
      // akışını KENDİLİĞİNDEN diriltmek. Uygulama süreci ayaktaysa bu veriyi
      // alır almaz `startTracking()` yeniden çağrılır ve şoförün hiçbir şey
      // yapması gerekmez. Süreç öldürülmüşse bildirim görünür kalır; şoför
      // dokununca uygulama açılır ve aynı akış işler.
      //
      // Neden gerekli: Transsion/HiOS gibi ROM'lar foreground service'i bile
      // öldürüyor (ölçüm: ~6,5 dk). Öldürülen servisi uygulama kendi başına
      // diriltemez — dışarıdan bir tetik şart, o tetik push'tur.
      ekstra: { tip: "konum-yeniden-baslat" },
    });

    // İŞLETMEYE — haritanın neden boş olduğunu ekrandan görsün.
    if (s.business.ownerId) {
      await notify({
        userId: s.business.ownerId,
        type: "genel",
        title: "⚠️ Şoförün konumu gelmiyor",
        body: hicGelmedi
          ? `${ad} mesaiyi açtı ama hiç konum göndermedi (${sessizDk} dk). Haritada göremezsin — şoförü ara.`
          : `${ad} mesaide görünüyor ama ${sessizDk} dakikadır konum gelmiyor. Haritadaki son nokta güncel değil.`,
        href: "/panel/takip",
      });
    }

    await prisma.appState.upsert({
      where: { key: anahtar(s.id) },
      create: { key: anahtar(s.id), value: new Date(simdi).toISOString() },
      update: { value: new Date(simdi).toISOString() },
    });

    console.error(
      `[konum-bekcisi] SESSİZ ŞOFÖR sofor=${s.id} ad="${ad}" isletme="${s.business.name}" sessiz=${sessizDk}dk hicGelmedi=${hicGelmedi}`,
    );
  }
}

import { haliSlotlari, fotografsizHalilar } from "@/lib/carpet";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPanelBusiness } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_META } from "@/lib/orderStatus";
import { photoStageLabel } from "@/lib/photoStage";
import { trDayBoundsUTC, trGunISO } from "@/lib/time";

export const metadata: Metadata = {
  title: "Halı Bul",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// HALI BUL — "bu kimin halısı?" (2026-08-02, işletme sahibinin isteği)
//
// PROBLEM: günde 200 halı yıkayan dükkânda halılar birbirine karışıyor.
// Önce QR/barkod düşünüldü, BIRAKILDI: ıslak halıya etiket tutturmak,
// etiket yazıcısı, iOS'ta barkod okuma derdi... Yerine FOTOĞRAF seçildi —
// altyapı zaten vardı.
//
// EKSİK OLAN parça buydu: fotoğraflar siparişin İÇİNDE duruyordu, yani halıyı
// elinde tutan kişi hangi siparişe ait olduğunu bilmeden fotoğrafı bulamıyordu.
// Bu ekran tersini yapar: dükkândaki TÜM halıların fotoğrafını tek duvarda
// gösterir, her karenin altında MÜŞTERİ ADI + HALI NO + sipariş kodu yazar.
// Elindeki halıyı gözünle eşleştirir, kimin olduğunu görürsün.
//
// KAPSAM: yalnız "dükkânda/yolda" olan siparişler (alındı · yıkanıyor ·
// teslimatta). Teslim edilenler listeyi şişirir, aranan halı onlar değildir.

const AKTIF = ["PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"] as const;

const inp =
  "w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-brand focus:outline-none";

/** 07.08.2026 — TR saat dilimiyle (sunucu UTC'de çalışıyor). */
function gunEtiketi(d: Date): string {
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });
}

export default async function HalilarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tarih?: string }>;
}) {
  const b = await getPanelBusiness();
  if (!b) redirect("/giris");
  const { q, tarih } = await searchParams;
  const arama = (q ?? "").trim();
  // TARİH SÜZGECİ (2026-08-07 akşam, kullanıcı: "halının alındığı tarih olsun,
  // onunla da arama yapılabilsin"). Gün TR takvimine göre — sunucu UTC'de
  // çalışıyor, ham tarih karşılaştırması günü 3 saat kaydırırdı.
  const tarihGecerli = tarih && /^\d{4}-\d{2}-\d{2}$/.test(tarih) ? tarih : null;
  const gun = tarihGecerli ? trDayBoundsUTC(tarihGecerli) : null;

  // Tarih kutusunun sınırları + kısayollar (2026-08-11). TR gününe göre
  // hesaplanır; sunucu UTC'de çalıştığı için ham ISO kesme gece yarısından
  // sonra günü bir gün geri alırdı.
  const bugun = trGunISO();
  const dun = trGunISO(new Date(Date.now() - 86_400_000));
  const oncekiGun = trGunISO(new Date(Date.now() - 2 * 86_400_000));
  // Alt sınır: bir yıl öncesi. Yanlış yıl (1926 gibi) tarayıcıda reddedilsin.
  const enEskiGun = trGunISO(new Date(Date.now() - 365 * 86_400_000));
  const KISAYOL_GUNLER = [
    { gun: bugun, etiket: "Bugün" },
    { gun: dun, etiket: "Dün" },
    { gun: oncekiGun, etiket: "Önceki gün" },
  ];

  // Arama sunucuda: 200 halılık dükkânda istemci tarafı filtre için tüm veriyi
  // telefona indirmek gerekirdi. Boş aramada da liste gelir (duvar görünümü).
  const siparisler = await prisma.order.findMany({
    where: {
      businessId: b.id,
      status: { in: [...AKTIF] },
      // Alım tarihi: yeni siparişlerde `pickedUpAt`, henüz alınmamış ya da eski
      // kayıtlarda `createdAt` (alan 2026-08-07'de eklendi, geriye dönük boş).
      ...(gun
        ? {
            OR: [
              { pickedUpAt: { gte: gun.start, lt: gun.end } },
              { pickedUpAt: null, createdAt: { gte: gun.start, lt: gun.end } },
            ],
          }
        : {}),
      ...(arama
        ? {
            OR: [
              { customerName: { contains: arama, mode: "insensitive" as const } },
              { customerPhone: { contains: arama } },
              { code: { contains: arama.toUpperCase() } },
              { note: { contains: arama, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      status: true,
      customerName: true,
      customerPhone: true,
      createdAt: true,
      pickedUpAt: true,
      carpetCount: true,
      // DÜKKÂN NUMARASI (2026-08-10) — depodaki kişinin elinde sipariş kodu
      // yok; aradığı tek şey halının üstündeki numara (bkz. lib/haliNo.ts).
      carpetNoBase: true,
      photos: {
        orderBy: [{ carpetNo: "asc" }, { createdAt: "asc" }],
        select: { id: true, url: true, stage: true, carpetNo: true },
      },
    },
  });

  // Her fotoğraf = bir kart. Fotoğrafı olmayan sipariş de görünür ("fotoğraf
  // yok" uyarısıyla) — aksi halde o halı bu ekranda YOK sayılır ve ekranın
  // vaadi ("dükkândaki her halı burada") yalan olurdu.
  type Kart = {
    key: string;
    orderId: string;
    url: string | null;
    no: number | null;
    /** DÜKKÂN NUMARASI — halının üstündeki etiket. Depoda aranan şey budur;
     *  `no` (sipariş içi sıra) yalnız eski kayıtlarda tek başına kalır. */
    dukkanNo: number | null;
    /** Siparişin tüm numara aralığı ("12" ya da "12–14") — alım karesi için. */
    aralik: string | null;
    stage: string | null;
    ad: string;
    tel: string;
    kod: string;
    durum: (typeof AKTIF)[number];
    /** Halının alındığı gün (yoksa siparişin açıldığı gün). */
    tarih: Date;
  };
  const kartlar: Kart[] = [];
  for (const o of siparisler) {
    // Sipariş içi sıra (1..N) → dükkân numarası. Base yoksa (numara sisteminden
    // önceki sipariş) null döner ve ekran eski davranışa düşer.
    const dukkan = (icSira: number | null): number | null =>
      o.carpetNoBase == null || icSira == null ? null : o.carpetNoBase + icSira - 1;
    // Siparişin numara aralığı — ŞOFÖRÜN ALIM KARESİ tek bir halıyı değil
    // yükün tamamını gösterir; ona tek numara yazmak yalan olur, aralık doğru.
    const kac = Math.max(1, o.carpetCount ?? 1);
    const aralik =
      o.carpetNoBase == null
        ? null
        : kac === 1
          ? `${o.carpetNoBase}`
          : `${o.carpetNoBase}–${o.carpetNoBase + kac - 1}`;
    const ortak = {
      orderId: o.id,
      ad: o.customerName,
      tel: o.customerPhone,
      kod: o.code ?? "",
      durum: o.status as (typeof AKTIF)[number],
      tarih: o.pickedUpAt ?? o.createdAt,
      aralik,
    };
    // 🔴 HALI SAYISI ALIMDAN GELİYOR (2026-08-06). Sipariş alınırken kaç halı
    // olduğu girildiyse (`carpetCount`), FOTOĞRAFI OLMAYAN halılar da burada
    // kart olarak görünür — "5 geldi, 5 gitti mi?" sorusunun cevabı bu.
    // Öncesinde numara fotoğraftan doğduğu için fotoğrafsız halı bu ekranda
    // hiç yoktu; sistem "kaç halı var" değil "kaç fotoğraf yüklendi" biliyordu.
    if (o.carpetCount != null) {
      for (const slot of haliSlotlari(o.carpetCount, o.photos)) {
        if (slot.fotograflar.length === 0) {
          kartlar.push({
            key: `${o.id}-no${slot.no}`,
            url: null,
            no: slot.no,
            dukkanNo: dukkan(slot.no),
            stage: null,
            ...ortak,
          });
          continue;
        }
        for (const p of slot.fotograflar) {
          kartlar.push({
            key: p.id,
            url: p.url,
            no: p.carpetNo,
            dukkanNo: dukkan(p.carpetNo),
            stage: p.stage,
            ...ortak,
          });
        }
      }
      // Numarasız fotoğraflar (aynı halının ek fotoğrafı / ŞOFÖRÜN ALIM KARESİ).
      // Bunlar tek bir halıyı göstermez; numara yerine siparişin ARALIĞI yazılır.
      for (const p of o.photos.filter((x) => x.carpetNo == null)) {
        kartlar.push({
          key: p.id,
          url: p.url,
          no: null,
          dukkanNo: null,
          stage: p.stage,
          ...ortak,
        });
      }
      continue;
    }

    // Eski sipariş (halı sayısı girilmemiş): davranış aynen korunur.
    if (o.photos.length === 0) {
      kartlar.push({
        key: `${o.id}-yok`,
        url: null,
        no: null,
        dukkanNo: null,
        stage: null,
        ...ortak,
      });
      continue;
    }
    for (const p of o.photos) {
      kartlar.push({
        key: p.id,
        url: p.url,
        no: p.carpetNo,
        dukkanNo: dukkan(p.carpetNo),
        stage: p.stage,
        ...ortak,
      });
    }
  }

  const fotografsiz = kartlar.filter((k) => !k.url).length;

  // Sayım uyumsuzluğu: alımda N halı girildi ama N'in fotoğrafı yok.
  // Depoda halı sayarken bakılacak asıl satır bu.
  const eksikFotograf = siparisler
    .map((o) => ({
      kod: o.code ?? "",
      ad: o.customerName,
      sayi: o.carpetCount,
      eksik: fotografsizHalilar(o.carpetCount, o.photos),
    }))
    .filter((x) => x.eksik.length > 0);

  return (
    <div className="space-y-4 py-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Halı Bul</h1>
        <p className="mt-1 text-sm text-slate-600">
          Elindeki halı kimin? Fotoğrafından bul. Dükkânda ve yolda olan{" "}
          <strong>{siparisler.length}</strong> siparişin{" "}
          <strong>{kartlar.filter((k) => k.url).length}</strong> halı fotoğrafı
          burada — her karenin altında müşterinin adı, halı numarası ve
          <strong> alım tarihi</strong> yazıyor.
        </p>
        {tarihGecerli && (
          <p className="mt-1 text-sm font-medium text-brand-dark">
            Süzgeç: {gunEtiketi(new Date(tarihGecerli + "T12:00:00"))} tarihinde
            alınan halılar
          </p>
        )}
      </div>

      <form method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={arama}
          placeholder="Müşteri adı, telefon veya sipariş kodu"
          aria-label="Halı ara"
          className={`${inp} sm:max-w-sm`}
        />
        {/* ALIM TARİHİ SÜZGECİ (2026-08-07 akşam, kullanıcı isteği).
            Metin aramasıyla BİRLİKTE çalışır: "o gün gelen Ayşe'nin halısı". */}
        {/* 🔴 YIL YAZDIRMA (2026-08-11, işletme sahibi: "adamlar neden 2026'yı
            girmek zorunda, gün ay girseler yeter").
            `<input type="date">` TARAYICININ kontrolü — yıl hanesi kaldırılamaz,
            Türkçe yerelde gg.aa.yyyy çizilir. Yapılabilecek şey yazdırmamak:
            (1) aşağıdaki tek dokunuşluk kısayollar — aramaların çoğu son
            birkaç gün, (2) `max` ile geleceğe gidiş kapalı, (3) `min` ile
            yanlış yıl (1926 gibi) reddedilir. */}
        <input
          type="date"
          name="tarih"
          defaultValue={tarihGecerli ?? ""}
          min={enEskiGun}
          max={bugun}
          aria-label="Alım tarihi"
          className={inp}
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Ara
        </button>
        {/* TEK DOKUNUŞLUK GÜNLER — tarih yazmaya gerek kalmasın. Aramaların
            çoğu "bugün gelenler" ya da "dün gelenler"; bunlar için takvim
            açmak da yıl yazmak da gereksiz. */}
        {KISAYOL_GUNLER.map((k) => (
          <Link
            key={k.gun}
            href={`/panel/halilar?tarih=${k.gun}${arama ? `&q=${encodeURIComponent(arama)}` : ""}`}
            className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              tarihGecerli === k.gun
                ? "border-brand bg-brand-light/40 text-brand-dark"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {k.etiket}
          </Link>
        ))}
        {(arama || tarihGecerli) && (
          <Link
            href="/panel/halilar"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Temizle
          </Link>
        )}
      </form>

      {/* SAYIM UYUMSUZLUĞU (2026-08-06): alımda "5 halı" girilmiş ama 3'ünün
          fotoğrafı var → 2'si kayıt dışı. Bu satır, ekranın asıl vaadini
          ("dükkândaki her halı burada") ölçülebilir hâle getiriyor. */}
      {eksikFotograf.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Fotoğrafı çekilmemiş halı var
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {eksikFotograf.slice(0, 8).map((x) => (
              <li key={x.kod + x.ad}>
                <span className="font-mono">{x.kod || "—"}</span> · {x.ad} —{" "}
                {x.sayi} halının {x.eksik.length}&apos;i eksik (
                {x.eksik.map((n) => `#${n}`).join(", ")})
              </li>
            ))}
          </ul>
          {eksikFotograf.length > 8 && (
            <p className="mt-1 text-xs text-amber-700">
              …ve {eksikFotograf.length - 8} sipariş daha.
            </p>
          )}
        </div>
      )}

      {fotografsiz > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{fotografsiz} siparişin hiç fotoğrafı yok.</strong> O halılar
          karışırsa fotoğraftan bulunamaz — siparişi açıp{" "}
          <strong>Fotoğraf ekle</strong> ile birer kare çek. Her fotoğraf
          otomatik numara alır (#1, #2, …).
        </p>
      )}

      {kartlar.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-medium text-slate-800">
            {arama ? "Aramana uyan halı yok." : "Dükkânda bekleyen halı yok."}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {arama
              ? "Müşterinin adını, telefonunu ya da sipariş kodunu dene."
              : "Halı alındığında (şoför ya da panelden) burada görünür."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {kartlar.map((k) => (
            <Link
              key={k.key}
              // HANGİ HALI OLDUĞUNU DA TAŞI (2026-08-11). Eskiden yalnız
              // sipariş kimliği gidiyordu: 2 numaralı halının karesine dokunup
              // giren kişi, fotoğraf kutusunda "Sıradaki halı" buluyordu —
              // yanlış halıya yükleme yapmanın en kolay yolu. Kart hangi halı
              // olduğunu ZATEN biliyor, linkte kaybediyorduk.
              href={`/panel/siparisler/${k.orderId}${k.no != null ? `?hali=${k.no}` : ""}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand"
            >
              <div className="relative">
                {k.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={k.url}
                    alt={`${k.ad} — halı ${k.no ?? ""}`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full bg-slate-100 object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-center text-xs text-slate-500">
                    Fotoğraf yok —<br />
                    eklemek için dokun
                  </div>
                )}
                {/* NUMARA ROZETİ (2026-08-10) — depodaki kişinin aradığı tek
                    şey bu. Öncelik DÜKKÂN numarasında: halının üstündeki etiket
                    o. Belirli bir halıya bağlı olmayan kare (şoförün alım
                    fotoğrafı yükün tamamıdır) için siparişin ARALIĞI yazılır —
                    ona tek numara yazmak yanlış halıyı gösterirdi. Numara
                    sisteminden önceki siparişlerde sipariş içi sıraya düşer. */}
                {k.dukkanNo != null ? (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/80 px-2 py-0.5 text-sm font-bold text-white">
                    No {k.dukkanNo}
                  </span>
                ) : k.aralik ? (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/60 px-2 py-0.5 text-sm font-bold text-white">
                    No {k.aralik}
                  </span>
                ) : k.no != null ? (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-slate-900/80 px-2 py-0.5 text-sm font-bold text-white">
                    #{k.no}
                  </span>
                ) : null}
                {k.stage && (
                  <span className="absolute right-1.5 top-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                    {photoStageLabel(k.stage)}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate font-semibold text-slate-900">{k.ad}</p>
                <p className="truncate text-xs text-slate-500">
                  {k.kod ? `${k.kod} · ` : ""}
                  {k.tel}
                </p>
                {/* ALIM TARİHİ (2026-08-07 akşam, kullanıcı isteği): "bu halı
                    ne zaman geldi" sorusu dükkânda en çok sorulan şey. */}
                <p className="truncate text-xs text-slate-500">
                  📅 {gunEtiketi(k.tarih)}
                </p>
                <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {ORDER_STATUS_META[k.durum].label}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Halı numarası, o siparişe yüklediğin fotoğrafların sırasıdır: bir
        müşterinin 5 halısı varsa #1…#5. Şoförün alım/teslim kanıt fotoğrafları
        numaralanmaz — onlar yükün tamamının karesidir.
      </p>
    </div>
  );
}

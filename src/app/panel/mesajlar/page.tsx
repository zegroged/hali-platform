import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPanelBusiness } from "@/lib/panel";
import EmptyState from "@/components/EmptyState";
import { IconWhatsApp } from "@/components/icons";
import WhatsAppReply from "@/components/WhatsAppReply";
import { waTelefonAdaylari } from "@/lib/whatsapp";
import { demoWaOku, DEMO_WA_SURE_SAAT } from "@/lib/demoWa";
import { PendingButton } from "@/components/PendingButton";
import { demoWaBaglaAction, demoWaCozAction } from "./actions";

// GELEN KUTUSU (2026-07-29): müşterinin WhatsApp'tan yazdığı mesajlar eskiden
// YALNIZ webhook log'una düşüyordu — halıcı ne görüyordu ne cevaplayabiliyordu.
// Bu sayfa mesajları numaraya göre sohbetlere ayırır ve 24 saatlik yanıt
// penceresi açıkken cevap yazmayı sağlar.
//
// 🔴 İZOLASYON: bütün sorgular businessId ile daraltılır. Oturum + rol kontrolü
// getPanelBusiness içinde prisma'ya GİTMEDEN ÖNCE yapılır (rol CLEANER değilse
// null döner); layout'un redirect'ine güvenilmez — daha önce bu yüzden RSC
// verisi sayfa kaynağından okunabilmişti.

export const dynamic = "force-dynamic";

/** Meta kuralı: müşteri yazdıktan sonra 24 saat serbest metin gönderilebilir. */
const PENCERE_MS = 24 * 60 * 60 * 1000;

/** 905321112233 → 0532 111 22 33 (okunur biçim). */
function telGoster(p: string): string {
  const d = p.replace(/\D/g, "");
  const y = d.startsWith("90") && d.length === 12 ? "0" + d.slice(2) : d;
  if (!/^0\d{10}$/.test(y)) return p;
  return `${y.slice(0, 4)} ${y.slice(4, 7)} ${y.slice(7, 9)} ${y.slice(9)}`;
}

/** tel: linki için sade numara. */
function telAra(p: string): string {
  const d = p.replace(/\D/g, "");
  return d.startsWith("90") ? "+" + d : d;
}

// SAAT DİLİMİ ZORUNLU (2026-07-29 denetim): bu sayfa SUNUCUDA çalışıyor ve
// konteynerde TZ tanımlı değil (UTC). timeZone verilmezse halıcı her mesajın
// saatini 3 saat GERİ görür; "bugün mü" kıyası da yanlış güne düşer.
const TZ = "Europe/Istanbul";
const saat = (d: Date) =>
  d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const gunAdi = (d: Date) =>
  d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });

/** Sohbet listesindeki zaman: bugünse saat, değilse gün/ay. */
function zamanKisa(d: Date): string {
  const gun = (x: Date) => x.toLocaleDateString("tr-TR", { timeZone: TZ });
  const bugun = gun(new Date()) === gun(d);
  return bugun
    ? saat(d)
    : d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", timeZone: TZ });
}

/** Siparişin müşteriye gösterilen kodu; yoksa kimliğin son 6 hanesi. */
const siparisKodu = (o: { id: string; code: string | null }) =>
  o.code ?? o.id.slice(-6).toUpperCase();

export default async function MesajlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ tel?: string; hata?: string; kaydedildi?: string }>;
}) {
  // 🔴 Oturum + rol + işletme — mesaj sorgusundan ÖNCE.
  const b = await getPanelBusiness();
  if (!b) return null;
  const { tel, hata, kaydedildi } = await searchParams;

  // DEMO WHATSAPP BAĞI (2026-08-04): yalnız demo panelinde görünür.
  const demoBag = b.isDemo ? await demoWaOku(b.id) : null;

  // Adres çubuğundan gelen numara: yalnız rakam. (İzolasyonu bu sağlamıyor —
  // sorgu zaten businessId ile daraltılıyor — ama saçma girdi sorguya girmesin.)
  const seciliTel = tel && /^\d{10,15}$/.test(tel) ? tel : null;

  // Sohbet listesi son 500 mesajdan kurulur; daha eskisi listede görünmez
  // ama sohbeti açınca (aşağıdaki sorgu) tam geçmiş gelir.
  //
  // ⚠️ 2026-07-30: giden sipariş bildirimleri de bu tabloya yazılmaya başlandı
  // (öncesinde yalnız gelenler + panelden verilen cevaplar vardı). Yoğun bir
  // işletmede trafiği artık OTOMATİK bildirimler domine ediyor; 500'lük pencere
  // günler içinde dolabilir ve CEVAPLANMAMIŞ eski bir müşteri mesajı listeden
  // düşebilirdi — gelen kutusunun tek işi buysa bu sessiz bir kayıptır.
  // Bu yüzden okunmamış GELEN mesajlar ayrıca çekilip listeye zorla ekleniyor.
  const [sonMesajlar, okunmamisGelen] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where: { businessId: b.id },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { order: { select: { id: true, code: true } } },
    }),
    prisma.whatsAppMessage.findMany({
      where: { businessId: b.id, direction: "IN", readAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { order: { select: { id: true, code: true } } },
    }),
  ]);
  // Birleştir + kimliğe göre tekille + yeniden eskiye sırala (haritayı kuran
  // döngü "ilk gördüğüm EN YENİ" varsayımına dayanıyor).
  const tumu = [...sonMesajlar, ...okunmamisGelen]
    .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i)
    .sort((a, b2) => b2.createdAt.getTime() - a.createdAt.getTime());

  type Kayit = (typeof sonMesajlar)[number];
  type Sohbet = {
    phone: string;
    /** WhatsApp profil adı — yalnız GELEN mesajda gelir, müşterinin bize
     *  verdiği ad olmak zorunda değil ("Ahmet", "Baba", boş...). */
    ad: string | null;
    /** Siparişteki GERÇEK müşteri adı (asıl kimlik). */
    musteriAdi: string | null;
    son: Kayit;
    okunmamis: number;
    siparis: { id: string; code: string | null } | null;
  };

  // Numara = sohbet. Liste yeniden eskiye sıralı geldiği için her numarada ilk
  // gördüğümüz kayıt EN YENİ olanıdır.
  const harita = new Map<string, Sohbet>();
  for (const m of tumu) {
    let s = harita.get(m.phone);
    if (!s) {
      s = {
        phone: m.phone,
        ad: null,
        musteriAdi: null,
        son: m,
        okunmamis: 0,
        siparis: null,
      };
      harita.set(m.phone, s);
    }
    if (!s.ad && m.name) s.ad = m.name;
    if (!s.siparis && m.order) s.siparis = m.order;
    if (m.direction === "IN" && !m.readAt) s.okunmamis++;
  }
  const sohbetler = [...harita.values()];

  // 🔴 KİMLİK EŞLEŞTİRME (2026-08-02, kullanıcı isteği: "sadece numara yazıyor,
  // isim soyisim eşleştirmemiz gerekiyor, karışıklık olur").
  //
  // Önceki durumda ekranda ya WhatsApp PROFİL adı ya da çıplak numara vardı:
  // - Giden bildirimle başlayan sohbette profil adı HİÇ gelmiyor (yalnız IN
  //   mesajlarda geliyor) → halıcı yalnız numara görüyordu.
  // - Gelse bile profil adı müşterinin bize verdiği ad değil ("Baba", "Ahmet")
  //   → halıcı kiminle konuştuğunu numaradan çıkarmak zorundaydı.
  //
  // Artık numara, BU İŞLETMENİN siparişlerindeki müşteri adıyla eşleştiriliyor.
  // `waTelefonAdaylari` TR dışı numarada BOŞ liste döner → yanlış eşleşme yerine
  // eşleşmemeyi seçer (aynı ilke gelen mesaj yönlendirmesinde de var).
  const adaylarHaritasi = new Map<string, string[]>();
  const tumAdaylar: string[] = [];
  for (const s of sohbetler) {
    const a = waTelefonAdaylari(s.phone);
    adaylarHaritasi.set(s.phone, a);
    tumAdaylar.push(...a);
  }
  const musteriSiparisleri = tumAdaylar.length
    ? await prisma.order.findMany({
        where: { businessId: b.id, customerPhone: { in: tumAdaylar } },
        orderBy: { createdAt: "desc" },
        select: { id: true, code: true, customerPhone: true, customerName: true },
      })
    : [];
  // En yeni sipariş kazanır (sorgu desc; ilk yazan kalır).
  const kimlikler = new Map<
    string,
    { ad: string; siparis: { id: string; code: string | null } }
  >();
  for (const o of musteriSiparisleri) {
    if (!kimlikler.has(o.customerPhone)) {
      kimlikler.set(o.customerPhone, {
        ad: o.customerName,
        siparis: { id: o.id, code: o.code },
      });
    }
  }
  for (const s of sohbetler) {
    for (const aday of adaylarHaritasi.get(s.phone) ?? []) {
      const k = kimlikler.get(aday);
      if (!k) continue;
      s.musteriAdi = k.ad;
      // Mesaj hiçbir siparişe bağlanmamışsa (eski kayıt) müşterinin son
      // siparişini göster — halıcı tek dokunuşla siparişe geçebilsin.
      if (!s.siparis) s.siparis = k.siparis;
      break;
    }
  }
  const seciliKimlik = seciliTel
    ? (sohbetler.find((s) => s.phone === seciliTel) ?? null)
    : null;

  // Açık sohbetin TAM geçmişi. 🔴 businessId olmadan ASLA sorgulanmaz.
  const mesajlar = seciliTel
    ? await prisma.whatsAppMessage.findMany({
        where: { businessId: b.id, phone: seciliTel },
        // EN YENİ 300 (2026-07-29 denetim): "asc + take" EN ESKİ 300'ü
        // getiriyordu — 300'ü aşan sohbette halıcı yıllar öncesini görüyor,
        // yeni mesajları HİÇ görmüyordu; dahası pencere hesabı da o eski
        // dilime bakıp "kapalı" diyordu. Aşağıda tekrar kronolojiye çevriliyor.
        orderBy: { createdAt: "desc" },
        take: 300,
        include: { order: { select: { id: true, code: true } } },
      })
    : [];

  // Sohbet başlığı için: en son gelen mesajın profil adı, bağlı sipariş ve
  // pencerenin dayandığı "müşteri en son ne zaman yazdı" bilgisi.
  // Sorgu "desc" geldi: gösterim için eskiden yeniye çevir, "tersi" ise
  // (en yeniden geriye) sorgunun kendi sırasıdır.
  const tersi = mesajlar;
  mesajlar.reverse();
  const seciliAd = tersi.find((m) => m.name)?.name ?? null;
  const seciliSiparis = tersi.find((m) => m.order)?.order ?? null;
  const sonGelen = tersi.find((m) => m.direction === "IN")?.createdAt ?? null;

  const kapanis = sonGelen ? new Date(sonGelen.getTime() + PENCERE_MS) : null;
  const kalanDk = kapanis
    ? Math.max(0, Math.floor((kapanis.getTime() - Date.now()) / 60000))
    : 0;

  // 5. AÇILIŞTA OKUNDU İŞARETLE. Yukarıdaki rozet sayıları bu güncellemeden
  // ÖNCE okunan veriden hesaplandı — halıcı bu açılışta kaç yeni mesaj
  // geldiğini görür, bir sonraki açılışta rozetler temizlenmiş olur.
  // YALNIZ AÇILAN SOHBET (2026-07-29 denetim): eskiden listeye girmek
  // İŞLETMENİN TÜM okunmamış mesajlarını okundu yapıyordu — halıcı üç
  // sohbetten birini açsa diğer ikisinin "yeni" rozeti bir daha görünmüyordu.
  // Özelliğin varlık sebebi müşteri mesajının kaybolmaması; tam tersini yapardı.
  if (seciliTel) {
    await prisma.whatsAppMessage.updateMany({
      where: { businessId: b.id, phone: seciliTel, direction: "IN", readAt: null },
      data: { readAt: new Date() },
    });
  }

  const kutu = "rounded-xl border border-slate-200 bg-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Mesajlar</h1>
        <span className="text-xs text-slate-500">
          WhatsApp — müşteriden gelen yazışmalar
        </span>
      </div>

      {hata && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {hata}
        </p>
      )}
      {kaydedildi && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {kaydedildi}
        </p>
      )}

      {/* DEMO WHATSAPP BAĞI — yalnız komisyoncunun demo panelinde.
          Sahadaki en güçlü an: halıcının KENDİ telefonuna gerçek mesaj düşmesi.
          Ayrıntı ve güvenlik gerekçeleri: lib/demoWa.ts */}
      {b.isDemo && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          {demoBag ? (
            <>
              <p className="text-sm font-semibold text-violet-900">
                Demo şu numaraya bağlı: {telGoster(demoBag.phone)}
              </p>
              <p className="mt-1 text-sm text-violet-800">
                Siparişi ilerlettiğinde (halı alındı · yıkama başladı · fiyat
                onayı · hazır · yolda · teslim) mesajlar{" "}
                <strong>gerçekten</strong> bu telefona gidiyor. Cevap kutusu ise
                ancak <strong>o sana yazdıktan sonra</strong> çalışır — WhatsApp
                kuralı: serbest mesaj için 24 saatlik pencerenin müşteri
                tarafından açılması gerekir. En iyi gösteri sırası: sen ilerlet
                → telefonu titresin → “şuna cevap yaz” de → cevabı bu ekranda
                çıksın. Bağ{" "}
                {demoBag.until.toLocaleString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: TZ,
                })}{" "}
                itibarıyla kendiliğinden kalkar.
              </p>
              <form action={demoWaCozAction} className="mt-3">
                <PendingButton className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60">
                  Bağı kaldır
                </PendingButton>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-violet-900">
                Demoyu telefona bağla
              </p>
              <p className="mt-1 text-sm text-violet-800">
                Karşındaki halıcının numarasını yaz: bundan sonra demo
                siparişini ilerlettiğinde WhatsApp mesajları{" "}
                <strong>gerçekten onun telefonuna</strong> düşer, yazdığı cevap
                da bu ekranda görünür. Bağ {DEMO_WA_SURE_SAAT} saat sonra
                kendiliğinden kalkar.
              </p>
              <form
                action={demoWaBaglaAction}
                className="mt-3 flex flex-wrap items-end gap-2"
              >
                <div className="min-w-0">
                  <label
                    htmlFor="demo-wa-tel"
                    className="block text-xs font-medium text-violet-900"
                  >
                    Halıcının cep numarası
                  </label>
                  <input
                    id="demo-wa-tel"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    required
                    placeholder="05XX XXX XX XX"
                    className="mt-0.5 w-52 max-w-full rounded-lg border border-violet-300 px-3 py-2.5 text-sm focus:border-violet-500"
                  />
                </div>
                <PendingButton className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60 sm:w-auto">
                  Bağla
                </PendingButton>
              </form>
              <p className="mt-2 text-xs text-violet-700">
                Numarayı yalnız <strong>izniyle</strong> yaz — mesajlar
                platformun kendi WhatsApp numarasından gider. Günde en fazla 5
                farklı numara.
              </p>
            </>
          )}
        </div>
      )}

      {sohbetler.length === 0 ? (
        <>
          <EmptyState
            icon={<IconWhatsApp size={22} />}
            title="Henüz WhatsApp mesajı yok"
            description="Müşteri WhatsApp'tan yazarsa burada görürsün ve buradan cevap verirsin. Sipariş bildirimlerine verilen cevaplar da bu listeye düşer."
          />
          <p className="text-xs text-slate-400">
            Mesajlar siparişteki telefon numarasına göre eşleştirilir. Sana hiç
            sipariş vermemiş bir numaradan gelen mesaj bu listeye düşmez.
          </p>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          {/* SOHBET LİSTESİ — mobilde sohbet açıkken gizlenir */}
          <div className={`space-y-2 ${seciliTel ? "hidden lg:block" : ""}`}>
            {sohbetler.map((s) => {
              const aktif = s.phone === seciliTel;
              return (
                <div
                  key={s.phone}
                  className={`overflow-hidden ${kutu} ${
                    aktif ? "border-brand ring-1 ring-brand" : ""
                  }`}
                >
                  <Link
                    href={`/panel/mesajlar?tel=${s.phone}`}
                    className="block p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {/* Kimlik sırası: siparişteki müşteri adı → WhatsApp
                            profil adı → numara. Numara HER ZAMAN altta yazar
                            (aynı ada sahip iki müşteri karışmasın). */}
                        <p className="truncate font-medium text-slate-900">
                          {s.musteriAdi ?? s.ad ?? telGoster(s.phone)}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {telGoster(s.phone)}
                          {s.musteriAdi && s.ad && s.ad !== s.musteriAdi && (
                            <span className="text-slate-400">
                              {" "}
                              · WhatsApp: {s.ad}
                            </span>
                          )}
                          {!s.musteriAdi && (
                            <span className="text-amber-700">
                              {" "}
                              · kayıtlı müşteri değil
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-400">
                          {zamanKisa(s.son.createdAt)}
                        </p>
                        {s.okunmamis > 0 && (
                          <span className="mt-1 inline-block rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
                            {s.okunmamis} yeni
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {s.son.direction === "OUT" && (
                        <span className="text-slate-400">Sen: </span>
                      )}
                      {s.son.body}
                    </p>
                  </Link>
                  {s.siparis && (
                    <div className="border-t border-slate-100 px-3 py-1.5">
                      <Link
                        href={`/panel/siparisler/${s.siparis.id}`}
                        className="text-xs font-medium text-brand-dark hover:underline"
                      >
                        Sipariş {siparisKodu(s.siparis)} →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-slate-400">
              Mesajlar siparişteki telefon numarasına göre eşleştirilir. Sana hiç
              sipariş vermemiş bir numaradan gelen mesaj bu listeye düşmez.
            </p>
          </div>

          {/* AÇIK SOHBET */}
          {seciliTel ? (
            <div className="space-y-3">
              <Link
                href="/panel/mesajlar"
                className="inline-block text-sm text-slate-500 hover:text-slate-800 lg:hidden"
              >
                ‹ Tüm sohbetler
              </Link>

              <div className={`${kutu} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {seciliKimlik?.musteriAdi ?? seciliAd ?? telGoster(seciliTel)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {telGoster(seciliTel)}
                      {seciliKimlik?.musteriAdi &&
                        seciliAd &&
                        seciliAd !== seciliKimlik.musteriAdi && (
                          <span className="text-slate-400">
                            {" "}
                            · WhatsApp adı: {seciliAd}
                          </span>
                        )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <a
                      href={`tel:${telAra(seciliTel)}`}
                      className="font-medium text-slate-600 hover:underline"
                    >
                      Ara
                    </a>
                    {seciliSiparis && (
                      <Link
                        href={`/panel/siparisler/${seciliSiparis.id}`}
                        className="font-medium text-brand-dark hover:underline"
                      >
                        Sipariş {siparisKodu(seciliSiparis)} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {mesajlar.length === 0 ? (
                <div className={`${kutu} p-6 text-center`}>
                  <p className="text-sm text-slate-500">
                    Bu numarayla bir yazışma bulunamadı.
                  </p>
                </div>
              ) : (
                <div className={`${kutu} space-y-2 p-4`}>
                  {mesajlar.map((m, i) => {
                    const onceki = i > 0 ? mesajlar[i - 1] : null;
                    const yeniGun =
                      !onceki ||
                      onceki.createdAt.toDateString() !==
                        m.createdAt.toDateString();
                    const gelen = m.direction === "IN";
                    return (
                      <div key={m.id}>
                        {yeniGun && (
                          <p className="py-2 text-center text-xs text-slate-400">
                            {gunAdi(m.createdAt)}
                          </p>
                        )}
                        <div
                          className={`flex ${gelen ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[75%] ${
                              gelen
                                ? "rounded-bl-sm bg-slate-100 text-slate-800"
                                : "rounded-br-sm bg-brand-light text-brand-dark"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {m.body}
                            </p>
                            <p
                              className={`mt-0.5 text-[11px] ${
                                gelen ? "text-slate-400" : "text-brand-dark/60"
                              }`}
                            >
                              {gelen ? "Müşteri" : "Sen"} · {saat(m.createdAt)}
                            </p>
                            {/* Gönderilemeyen mesaj: halıcı "gitti" sanmasın. */}
                            {m.error && (
                              <p className="mt-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-700">
                                ⚠️ Gitmedi: {m.error}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <WhatsAppReply
                phone={seciliTel}
                kalanDk={kalanDk}
                kapanisISO={kapanis ? kapanis.toISOString() : null}
              />
            </div>
          ) : (
            <div
              className={`hidden items-center justify-center border-dashed p-10 text-center text-sm text-slate-500 lg:flex ${kutu}`}
            >
              Soldan bir sohbet seç; yazışma burada açılır.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

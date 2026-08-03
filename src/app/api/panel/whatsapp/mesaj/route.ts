import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { sendText, waTelefonAdaylari, whatsappEnabled } from "@/lib/whatsapp";

// PANEL GELEN KUTUSU — CEVAP GÖNDERME UCU (2026-07-29).
//
// Müşterinin WhatsApp'tan yazdığı mesaj artık panelde görünüyor; burası halıcının
// oradan CEVAP yazdığı uç. İki sert kural var:
//
// 1) İZOLASYON: numara, BU işletmeye ait bir yazışmada geçmiyorsa gönderim
//    reddedilir (403). Sistem halıcının reklam aracı değildir — yalnız kendisine
//    yazmış müşteriye cevap yazılabilir. (Sorgular HER ZAMAN businessId ile
//    daraltılır; oturum+rol kontrolü prisma'ya gitmeden ÖNCE yapılır.)
// 2) 24 SAAT (Meta kuralı): müşteri bize yazdıktan sonra 24 saat serbest metin
//    gönderilebilir; pencere kapanınca yalnız onaylı ŞABLON gider. Pencereyi
//    burada ölçüyoruz ki halıcı Meta'nın 131047 hatasını değil, ne olduğunu
//    anlatan Türkçe bir cümle görsün.

export const dynamic = "force-dynamic";

const PENCERE_MS = 24 * 60 * 60 * 1000;

const Body = z.object({
  phone: z.string().min(10, "Numara eksik.").max(20, "Numara geçersiz."),
  body: z.string().max(1000, "Mesaj en fazla 1000 karakter olabilir."),
});

const saat = (d: Date) =>
  d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });

export async function POST(req: NextRequest) {
  // 🔴 SIRA ÖNEMLİ: prisma'ya gitmeden ÖNCE oturum + rol + işletme.
  // getCurrentBusiness kendi içinde oturumu doğrular ve rolü CLEANER değilse
  // null döner — layout/redirect korumasına GÜVENİLMEZ (bu depoda korumalı
  // sayfa verisi bir kez bu yüzden sızmıştı).
  const b = await getCurrentBusiness();
  if (!b) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  // HIZ SINIRI: her mesaj Meta'da faturalanabilir. Elle yazan bir halıcı 10
  // dakikada 20 mesajı zor geçer; bunu aşan şey ya bozuk bir döngü ya kötüye
  // kullanımdır. Sınır İŞLETME başına (IP değil) — aynı hesap farklı ağdan da
  // girse fren aynı yerde durur.
  // SINIR SAATLİK (2026-07-29 denetim): 10 dakikada 20 mesaj = günde 2.880,
  // oysa PLATFORM GENELİ günlük tavan 2.000. Tek işletme bütün platformun
  // WhatsApp'ını kapatabiliyordu. Saatlik 20 → günde en fazla 480.
  const rl = rateLimit(`wa-cevap:${b.id}`, 20, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  // Gövde demo kalkanından ÖNCE ayrıştırılıyor: kalkanın hangi numaraya
  // yazıldığını bilmesi gerekiyor (istek gövdesi bir kez okunabilir).
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Geçersiz veri" },
      { status: 400 },
    );
  }

  // DEMO KALKANI (2026-08-02): demo panele örnek bir yazışma eklendi; o sohbette
  // cevap kutusu AÇIK görünür (müşteri "3 saat önce" yazmış gibi). Kalkan
  // olmasaydı komisyoncu dükkânda cevap yazmayı denediğinde sistem uydurma bir
  // numaraya GERÇEK gönderim yapmaya kalkardı. Aynı ilke `waGonderVeKaydet` ve
  // `sendSms` içinde de var.
  // TEK İSTİSNA (2026-08-04): komisyoncu demoyu karşısındaki halıcının GERÇEK
  // numarasına bağladıysa (lib/demoWa.ts) O NUMARAYA cevap yazmak serbesttir —
  // "sana yazayım, telefonuna baksana" anı satışın kendisidir. Kalkan diğer
  // bütün numaralar için aynen duruyor.
  if (b.isDemo) {
    const { demoWaGecerliMi } = await import("@/lib/demoWa");
    if (!(await demoWaGecerliMi(b.id, parsed.data.phone))) {
      return NextResponse.json(
        {
          error:
            "Demo hesap: bu numaraya mesaj gerçekten gönderilmez. Mesajlar ekranındaki “Demoyu telefona bağla” kutusuna karşındakinin numarasını yazarsan mesajlar ona GERÇEKTEN gider.",
        },
        { status: 400 },
      );
    }
  }
  const metin = parsed.data.body.trim();
  if (!metin)
    return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 });

  if (!whatsappEnabled)
    return NextResponse.json(
      { error: "WhatsApp gönderimi şu an kapalı. Müşteriyi telefonla arayın." },
      { status: 503 },
    );

  // Numara biçimi: Meta 905xxxxxxxxx yollar, kayıtlar da öyle tutulur; yine de
  // 0532… / +90532… gibi biçimlerle arama yapılabilsin diye adaylar üretiliyor.
  // TR dışı / bozuk numara boş liste döner.
  const adaylar = waTelefonAdaylari(parsed.data.phone);
  if (adaylar.length === 0)
    return NextResponse.json({ error: "Numara geçersiz." }, { status: 400 });

  const [yazisma, sonGelen] = await Promise.all([
    // 🔴 İZOLASYON: yalnız BU işletmenin yazışmalarında geçen numara.
    prisma.whatsAppMessage.findFirst({
      where: { businessId: b.id, phone: { in: adaylar } },
      select: { id: true },
    }),
    // 24 saat penceresi müşterinin SON yazdığı ana göre işler (OUT sayılmaz).
    prisma.whatsAppMessage.findFirst({
      where: { businessId: b.id, phone: { in: adaylar }, direction: "IN" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, phone: true, orderId: true },
    }),
  ]);

  if (!yazisma)
    return NextResponse.json(
      {
        error:
          "Bu numarayla işletmenize ait bir WhatsApp yazışması yok. Yalnız size yazan müşterilere cevap gönderebilirsiniz.",
      },
      { status: 403 },
    );

  if (!sonGelen)
    return NextResponse.json(
      {
        error:
          "Bu numaradan gelen bir mesaj yok; 24 saatlik yanıt penceresi açılmamış. Serbest metin gönderilemez.",
      },
      { status: 400 },
    );

  if (Date.now() - sonGelen.createdAt.getTime() > PENCERE_MS)
    return NextResponse.json(
      {
        error: `Müşteri en son ${saat(sonGelen.createdAt)} yazmış; 24 saatlik yanıt penceresi kapandı. Serbest metin gönderilemez. Müşteri tekrar yazarsa pencere yeniden açılır; acilse telefonla arayın.`,
      },
      { status: 400 },
    );

  // Gönderimi kayıttaki numaraya yapıyoruz (halıcının yazdığı biçime değil) —
  // sohbet dizisi tek numara altında toplanır.
  const r = await sendText(sonGelen.phone, metin);
  if (!r.ok) {
    console.error(`[wa-cevap] gönderilemedi isletme=${b.id}: ${r.error ?? "-"}`);
    return NextResponse.json(
      { error: `Mesaj gönderilemedi: ${r.error ?? "bilinmeyen hata"}` },
      { status: 502 },
    );
  }

  // KAYIT: gönderilen mesaj da gelen kutusunda görünmeli, yoksa halıcı ne
  // yazdığını hatırlamaz. waId benzersiz — Meta kimlik döndürmediyse (olmaması
  // gereken hâl) yerel bir kimlikle kaydediyoruz; mesaj GİTTİ, kaydı düşmesin.
  // Kayıt hatası gönderimi geri alamaz: ok:true dönüp uyarıyı ayrıca veriyoruz.
  try {
    const kayit = await prisma.whatsAppMessage.create({
      data: {
        waId: r.id ?? `yerel-${randomUUID()}`,
        direction: "OUT",
        phone: sonGelen.phone,
        body: metin,
        businessId: b.id,
        orderId: sonGelen.orderId ?? undefined,
      },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({
      ok: true,
      id: kayit.id,
      createdAt: kayit.createdAt,
      body: metin,
    });
  } catch (e) {
    console.error("[wa-cevap] gönderildi ama kaydedilemedi:", e);
    return NextResponse.json({
      ok: true,
      uyari: "Mesaj gönderildi ama yazışma geçmişine kaydedilemedi.",
      body: metin,
    });
  }
}

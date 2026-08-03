import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { sendText, waTelefonAdaylari, whatsappEnabled } from "@/lib/whatsapp";

// SAHİPSİZ MESAJLARA ADMİN CEVABI (2026-08-03, kullanıcı isteği)
//
// /admin/wa-mesajlar ekranı 30 Temmuz'da BİLEREK salt-okunur yapılmıştı:
// "platform kendi adına müşteriyle yazışmaya girmiyor (aracı hizmet
// sağlayıcıyız)". Kullanıcı bu kararı değiştirdi — kendisine yazan kişiye
// cevap verebilmek istiyor. Gerekçe makul: buraya düşen mesajlar zaten
// HİÇBİR işletmeye bağlanamamış, yani karşı taraf platformun kendisine
// yazıyor (fiyat soran müşteri adayı).
//
// ÜÇ SERT KURAL:
// 1) YALNIZ SAHİPSİZ NUMARA. Numaranın son gelen mesajı bir işletmeye
//    bağlıysa (businessId dolu) admin oraya yazamaz — o, halıcının müşterisiyle
//    yazışmasıdır; araya girmek hem karışıklık hem güven sorunudur.
// 2) YALNIZ BİZE YAZMIŞ NUMARA + 24 SAAT (Meta kuralı): serbest metin ancak
//    karşı taraf son 24 saatte yazdıysa gider. Kapalıysa Meta 131047 döndürür,
//    mesaj ULAŞMAZ; o yüzden burada durduruluyor ve sebebi yazılıyor.
// 3) Hız sınırı: her mesaj faturalanabilir.

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
  // Yetki kapısı prisma'dan ÖNCE.
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN")
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const rl = rateLimit(`wa-admin-cevap:${u.id}`, 20, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz veri" },
      { status: 400 },
    );
  }
  const metin = parsed.data.body.trim();
  if (!metin)
    return NextResponse.json({ error: "Mesaj boş olamaz." }, { status: 400 });

  if (!whatsappEnabled)
    return NextResponse.json(
      { error: "WhatsApp gönderimi şu an kapalı." },
      { status: 503 },
    );

  const adaylar = waTelefonAdaylari(parsed.data.phone);
  if (adaylar.length === 0)
    return NextResponse.json({ error: "Numara geçersiz." }, { status: 400 });

  const sonGelen = await prisma.whatsAppMessage.findFirst({
    where: { phone: { in: adaylar }, direction: "IN" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, phone: true, businessId: true },
  });

  if (!sonGelen)
    return NextResponse.json(
      {
        error:
          "Bu numaradan gelen mesaj yok; 24 saatlik yanıt penceresi hiç açılmamış.",
      },
      { status: 400 },
    );

  if (sonGelen.businessId)
    return NextResponse.json(
      {
        error:
          "Bu numara artık bir işletmenin yazışmasına bağlı. Araya girme: müşteriyle o işletme yazışıyor.",
      },
      { status: 403 },
    );

  if (Date.now() - sonGelen.createdAt.getTime() > PENCERE_MS)
    return NextResponse.json(
      {
        error: `Son mesaj ${saat(sonGelen.createdAt)} tarihinde geldi; 24 saatlik yanıt penceresi kapandı. Serbest metin gönderilemez — karşı taraf tekrar yazarsa pencere açılır.`,
      },
      { status: 400 },
    );

  const r = await sendText(sonGelen.phone, metin);
  if (!r.ok) {
    console.error(`[wa-admin-cevap] gönderilemedi: ${r.error ?? "-"}`);
    return NextResponse.json(
      { error: `Mesaj gönderilemedi: ${r.error ?? "bilinmeyen hata"}` },
      { status: 502 },
    );
  }

  // Gönderilen mesaj da sahipsiz kutuda görünsün (businessId null kalır) —
  // yoksa admin ne yazdığını hatırlamaz ve aynı kişiye iki kez yazar.
  try {
    await prisma.whatsAppMessage.create({
      data: {
        waId: r.id ?? `yerel-${randomUUID()}`,
        direction: "OUT",
        phone: sonGelen.phone,
        body: metin,
      },
    });
  } catch (e) {
    console.error("[wa-admin-cevap] gönderildi ama kaydedilemedi:", e);
    return NextResponse.json({
      ok: true,
      uyari: "Mesaj gönderildi ama kayda geçmedi.",
    });
  }
  return NextResponse.json({ ok: true, body: metin });
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WhatsAppReply from "@/components/WhatsAppReply";

export const dynamic = "force-dynamic";

const TZ = "Europe/Istanbul";
const PENCERE_MS = 24 * 60 * 60 * 1000;
const zaman = (d: Date) =>
  d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });

// SAHİPSİZ WHATSAPP MESAJLARI (2026-07-30 kullanıcı isteği).
//
// NEDEN VAR: gelen mesaj, numaranın son siparişinden işletmeye eşleştiriliyor
// (api/whatsapp/webhook). Eşleşme kurulamayan mesajlar `businessId=null` kalıyor
// ve BUGÜNE KADAR HİÇBİR YERDE GÖRÜNMÜYORDU — yani hiç siparişi olmayan biri
// (fiyat soran yeni müşteri adayı!) yazdığında mesaj sessizce veritabanında
// kalıyordu. Bu ekran o boşluğu kapatıyor.
//
// Ayrıca kaçırma (hijack) savunması yüzünden sahipsiz kalanlar da burada
// görünür: bir numara daha önce BAŞKA işletmeye bağlandıysa mesaj sessizce el
// değiştirmiyor, buraya düşüyor ve admin kararı bekliyor.
//
// 2026-08-03: EKRAN ARTIK SALT-OKUNUR DEĞİL. Önceki not "platform kendi adına
// müşteriyle yazışmaya girmiyor" diyordu; kullanıcı bu kararı değiştirdi.
// Buradaki kişi zaten hiçbir işletmeye bağlanamamış, yani doğrudan platforma
// yazıyor. Cevap kuralları api/admin/whatsapp/mesaj içinde: yalnız SAHİPSİZ
// numaraya, yalnız 24 saatlik pencere açıkken.
export default async function AdminWaMesajlar() {
  // YETKİ KAPISI — prisma'dan ÖNCE (layout redirect'i RSC sızıntısını tek
  // başına engellemez; bu ekranda müşteri telefonu ve mesaj metni var).
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");

  // Sahipsiz kutu: gelen VE bu ekrandan gönderilen mesajlar (ikisi de
  // businessId=null). Giden mesaj da listelenmezse admin ne yazdığını
  // hatırlamaz ve aynı kişiye ikinci kez yazar.
  const mesajlar = await prisma.whatsAppMessage.findMany({
    where: { businessId: null },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  type Sohbet = {
    phone: string;
    ad: string | null;
    son: Date;
    gelen: number;
    sonGelen: Date | null;
    kayitlar: typeof mesajlar;
  };
  const sohbetler = new Map<string, Sohbet>();
  for (const m of mesajlar) {
    const v = sohbetler.get(m.phone);
    if (v) {
      v.kayitlar.push(m);
      if (!v.ad && m.name) v.ad = m.name;
      if (m.direction === "IN") {
        v.gelen += 1;
        if (!v.sonGelen) v.sonGelen = m.createdAt; // liste yeniden eskiye
      }
    } else {
      sohbetler.set(m.phone, {
        phone: m.phone,
        ad: m.name,
        son: m.createdAt,
        gelen: m.direction === "IN" ? 1 : 0,
        sonGelen: m.direction === "IN" ? m.createdAt : null,
        kayitlar: [m],
      });
    }
  }
  const liste = [...sohbetler.values()];
  const toplamGelen = mesajlar.filter((m) => m.direction === "IN").length;

  const kutu = "rounded-xl border border-slate-200 bg-white";

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-16 md:max-w-3xl lg:max-w-5xl">
      <Link href="/admin" className="mt-4 inline-block text-sm text-brand-dark hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 text-xl font-bold text-slate-900">
        Sahipsiz WhatsApp Mesajları
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Hiçbir siparişle eşleşmediği için bir işletmeye bağlanamayan mesajlar.
        Genelde iki durumda olur: <strong>hiç sipariş vermemiş biri</strong>{" "}
        yazdı (fiyat soran müşteri adayı), ya da numara daha önce başka bir
        işletmeye bağlıydı ve mesaj güvenlik gereği sessizce el değiştirmedi.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Buradan <strong>cevap yazabilirsin</strong>. WhatsApp kuralı gereği
        serbest metin yalnız karşı taraf <strong>son 24 saatte</strong>{" "}
        yazdıysa gider; pencere kapalıysa kutu kapalı olur ve sebebi yazar.
        Numara bir işletmenin yazışmasına bağlandıysa buradan yazılamaz — o
        müşteriyle halıcı yazışır.
      </p>

      {liste.length === 0 ? (
        <p className={`${kutu} mt-4 p-4 text-sm text-slate-500`}>
          Sahipsiz mesaj yok. Gelen her mesaj bir siparişe bağlanabilmiş.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-700">
            <strong>{liste.length}</strong> numara ·{" "}
            <strong>{toplamGelen}</strong> gelen mesaj
          </p>
          <ul className="mt-2 space-y-3">
            {liste.map((s) => {
              const kapanis = s.sonGelen
                ? new Date(s.sonGelen.getTime() + PENCERE_MS)
                : null;
              const kalanDk = kapanis
                ? Math.max(0, Math.floor((kapanis.getTime() - Date.now()) / 60000))
                : 0;
              // Eskiden yeniye çevir: sohbet okunurken doğal sıra budur.
              const kayitlar = [...s.kayitlar].reverse();
              return (
                <li key={s.phone} className={`${kutu} p-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 font-medium text-slate-900">
                      {s.ad?.trim() || "İsimsiz"}{" "}
                      <span className="break-all font-normal text-slate-500">
                        · {s.phone}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {s.gelen > 1 && `${s.gelen} gelen · `}
                      {zaman(s.son)}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {kayitlar.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          m.direction === "OUT"
                            ? "ml-auto bg-brand-light text-slate-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className="mt-0.5 text-right text-[11px] text-slate-500">
                          {m.direction === "OUT" ? "Sen · " : ""}
                          {zaman(m.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <WhatsAppReply
                      phone={s.phone}
                      kalanDk={kalanDk}
                      kapanisISO={kapanis ? kapanis.toISOString() : null}
                      endpoint="/api/admin/whatsapp/mesaj"
                      yerTutucu="Cevabını yaz…"
                    />
                  </div>

                  <a
                    href={`https://wa.me/${s.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-brand-dark hover:underline"
                  >
                    WhatsApp&apos;ta aç →
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

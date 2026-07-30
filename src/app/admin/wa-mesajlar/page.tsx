import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TZ = "Europe/Istanbul";
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
export default async function AdminWaMesajlar() {
  // YETKİ KAPISI — prisma'dan ÖNCE (layout redirect'i RSC sızıntısını tek
  // başına engellemez; bu ekranda müşteri telefonu ve mesaj metni var).
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");

  const mesajlar = await prisma.whatsAppMessage.findMany({
    where: { businessId: null, direction: "IN" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Numaraya göre grupla — aynı kişinin 5 mesajı 5 satır olmasın.
  const sohbetler = new Map<
    string,
    { phone: string; ad: string | null; son: Date; adet: number; ilkMetin: string }
  >();
  for (const m of mesajlar) {
    const v = sohbetler.get(m.phone);
    if (v) {
      v.adet += 1;
      if (!v.ad && m.name) v.ad = m.name;
    } else {
      sohbetler.set(m.phone, {
        phone: m.phone,
        ad: m.name,
        son: m.createdAt,
        adet: 1,
        ilkMetin: m.body,
      });
    }
  }
  const liste = [...sohbetler.values()];

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

      {liste.length === 0 ? (
        <p className={`${kutu} mt-4 p-4 text-sm text-slate-500`}>
          Sahipsiz mesaj yok. Gelen her mesaj bir siparişe bağlanabilmiş.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-700">
            <strong>{liste.length}</strong> numara ·{" "}
            <strong>{mesajlar.length}</strong> mesaj
          </p>
          <ul className="mt-2 space-y-2">
            {liste.map((s) => (
              <li key={s.phone} className={`${kutu} p-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">
                    {s.ad?.trim() || "İsimsiz"}{" "}
                    <span className="font-normal text-slate-500">
                      · {s.phone}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {s.adet > 1 && `${s.adet} mesaj · `}
                    {zaman(s.son)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{s.ilkMetin}</p>
                {/* Cevap ucu YOK: platform kendi adına müşteriyle yazışmaya
                    girmiyor (aracı hizmet sağlayıcıyız). Admin ya numarayı
                    ilgili halıcıya iletir ya da WhatsApp'tan kendisi yazar. */}
                <a
                  href={`https://wa.me/${s.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-brand-dark hover:underline"
                >
                  WhatsApp&apos;ta aç →
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

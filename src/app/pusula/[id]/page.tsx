import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stopajHesapla, STOPAJ_ORAN } from "@/lib/stopaj";
import { SIRKET } from "@/lib/sirket";
import PrintButton from "@/components/PrintButton";

// GİDER PUSULASI — /pusula/[id] (2026-08-01 denetim bulgusuyla /admin DIŞINA
// taşındı: /admin layout'u ACCOUNTANT'ı /giris'e atıyordu, sayfanın kendi izni
// hiç devreye giremiyordu; mali müşavir muhasebe dökümünden buraya tıklar).
//
// NE ZAMAN KULLANILIR: komisyoncu VERGİ MÜKELLEFİ DEĞİLSE (fatura kesemiyorsa)
// platform ödemeyi gider pusulasıyla belgeler ve stopajı keserek NET öder.
// Komisyoncu fatura kesebiliyorsa BU BELGE KULLANILMAZ — fatura alınır.
//
// ⚠️ Bu şablon MALİ MÜŞAVİR TEYİDİNE tabidir (oran, eşik, GİB e-belge
// yükümlülükleri). Sistem tutarlara DOKUNMAZ; bu sayfa yalnız belgeyi üretir.

// /admin dışına taşınınca admin layout'unun noindex'i kayboldu — kendi başlığı:
export const metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

const tl = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function GiderPusulasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 🔴 Yetki prisma'dan ÖNCE (RSC sızıntı dersi) — belge kişisel veri içerir.
  // ACCOUNTANT da görebilir (2026-07-31): muhtasar beyanname bu belgeden
  // hazırlanır, mali müşavir /muhasebe dökümünden buraya tıklar.
  const u = await getSessionUser();
  if (!u || (u.role !== "ADMIN" && u.role !== "ACCOUNTANT")) redirect("/giris");

  const { id } = await params;
  const t = await prisma.payoutRequest.findUnique({
    where: { id },
    include: {
      agent: {
        select: {
          taxId: true,
          iban: true,
          ibanName: true,
          address: true,
          user: { select: { name: true, phone: true } },
        },
      },
    },
  });
  if (!t) notFound();

  // ÖDENMİŞ ama STOPAJSIZ kapanmış talep için pusula YOK (denetim): mükellef/
  // eşik-altı ödemeye "stopaj kesildi" görünümlü belge üretmek yanlış kayıttır.
  if (t!.status === "PAID" && t!.stopajTutar == null) {
    return (
      <div className="mx-auto max-w-xl px-6 py-12 text-center">
        <p className="text-lg font-semibold text-slate-900">
          Bu ödemede stopaj kesilmedi
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Talep brüt ödenerek kapatılmış (fatura mükellefi ya da eşik altı) —
          gider pusulası düzenlenmez. Mükellef ödemesiyse karşılığında FATURA
          alınmış olmalı.
        </p>
      </div>
    );
  }

  const brut = Number(t!.paidAmount ?? t!.amount);
  // ÖDENMİŞ talepte KAYITLI stopaj kullanılır (ödeme anında otomatik yazıldı) —
  // oran sonradan değişse de belge tarihî gerçeği gösterir. Bekleyen talepte
  // güncel oranla önizleme hesaplanır.
  const d =
    t.stopajTutar != null
      ? {
          brut,
          oran: Number(t.stopajOran ?? 0) / 100,
          stopaj: Number(t.stopajTutar),
          net: Number(t.netTutar ?? brut - Number(t.stopajTutar)),
        }
      : stopajHesapla(brut);
  const bugun = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <a href="/admin/komisyoncular" className="text-sm text-brand-dark hover:underline">
          ← Komisyoncular
        </a>
        <PrintButton />
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-8 print:rounded-none print:border-0 print:p-0">
        <h1 className="text-center text-xl font-bold tracking-wide text-slate-900">
          GİDER PUSULASI
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Tarih: {bugun} · Belge no: {t.id.slice(-8).toUpperCase()}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-900">Düzenleyen (İşletme)</p>
            <p className="mt-1 text-slate-700">
              {SIRKET.yasalAd} — {SIRKET.ticariAd}
              <br />
              {SIRKET.adres}
              <br />
              {SIRKET.vergiDairesi} VD · VKN {SIRKET.vergiNo}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-900">
              İşi Yapan / Ödeme Yapılan
            </p>
            <p className="mt-1 text-slate-700">
              {t.ibanName ?? t.agent.ibanName ?? t.agent.user.name}
              <br />
              Adres: {t.agent.address ?? "____________________"}
              <br />
              Tel: {t.agent.user.phone}
              <br />
              T.C./VKN: {t.agent.taxId ?? "____________________"}
              <br />
              IBAN: <span className="font-mono">{t.iban ?? t.agent.iban ?? "—"}</span>
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-700">
          <strong>İşin türü:</strong> Platform aracılık/komisyon hizmeti
          (işletme kayıt yönlendirmesi) — döneme ait komisyon alacağının ödemesi.
        </p>

        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="py-2 text-slate-600">Brüt tutar</td>
              <td className="py-2 text-right font-semibold text-slate-900">
                {tl(d.brut)} TL
              </td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="py-2 text-slate-600">
                Gelir vergisi stopajı (%{Math.round(d.oran * 100)})
              </td>
              <td className="py-2 text-right font-semibold text-red-700">
                − {tl(d.stopaj)} TL
              </td>
            </tr>
            <tr>
              <td className="py-3 text-base font-bold text-slate-900">
                ÖDENEN NET TUTAR
              </td>
              <td className="py-3 text-right text-base font-bold text-slate-900">
                {tl(d.net)} TL
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8 grid grid-cols-2 gap-8 text-center text-sm text-slate-600">
          <div>
            <div className="mx-auto h-16 border-b border-slate-400" />
            <p className="mt-1">Düzenleyen — imza</p>
          </div>
          <div>
            <div className="mx-auto h-16 border-b border-slate-400" />
            <p className="mt-1">İşi yapan — imza</p>
          </div>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          <strong>Belge niteliği (VUK md. 234, 7338 değişikliği):</strong>{" "}
          Ödeme banka aracılığıyla yapıldığından <strong>banka dekontu gider
          pusulası yerine geçer</strong>; bu çıktı, dekontun stopaj dökümünü
          gösteren iç ekidir — dekontla birlikte saklayın (5 yıl). Matbaa
          basımlı pusula kullanılacaksa bu döküm oradaki alanlara aynen
          geçirilir. Belge, hizmet/ödeme tarihinden itibaren en geç{" "}
          <strong>7 gün içinde</strong> düzenlenmiş olmalıdır; iki nüsha
          hazırlanır, biri işi yapanda kalır. Kesilen stopaj platformca
          muhtasar beyannameyle beyan edilir. Komisyoncu vergi mükellefiyse bu
          belge KULLANILMAZ — fatura alınır, brüt ödenir. Oran/eşik ve dekont
          ikamesi yorumu mali müşavir teyidine tabidir.
        </p>
      </div>
    </div>
  );
}

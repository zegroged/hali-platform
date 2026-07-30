"use client";

// Panel gezinmesi (2026-07-26 yenilendi):
// - MASAÜSTÜ: üstte yatay sekmeler (eskisi gibi, artık kaymaya gerek yok).
// - MOBİL: altta SABİT çubuk — 4 ana sekme + "Daha fazla" açılır listesi.
//   Neden hamburger değil: halıcı telefonu tek elle kullanıyor; alt çubuk
//   başparmak menzilinde ve uygulama hissi veriyor. Eski yatay kayan çubukta
//   sekmelerin yarısı ekran dışında kalıyor, kullanıcı fark etmiyordu.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/panel", label: "Özet" },
  { href: "/panel/siparisler", label: "Siparişler" },
  { href: "/panel/yeni-siparis", label: "Yeni Kayıt" },
  { href: "/panel/takip", label: "Canlı Takip" },
  { href: "/panel/mesajlar", label: "Mesajlar" },
  { href: "/panel/kasa", label: "Kasa" },
  { href: "/panel/mutabakat", label: "Mutabakat" },
  { href: "/panel/hatirlatma", label: "Hatırlatma" },
  { href: "/panel/profil", label: "Profil & Fiyat" },
  { href: "/panel/soforler", label: "Şoförler" },
  { href: "/panel/rota", label: "Rota Geçmişi" },
  { href: "/panel/rapor", label: "Raporlar" },
];

// Mobil alt çubukta duracak 4 ana sekme; kalanı "Daha fazla" içinde.
const MOBIL_ANA = ["/panel", "/panel/siparisler", "/panel/yeni-siparis", "/panel/takip"];

function aktifMi(pathname: string, href: string) {
  return href === "/panel" ? pathname === "/panel" : pathname.startsWith(href);
}

export default function PanelNav() {
  const pathname = usePathname() ?? "";
  const [acik, setAcik] = useState(false);

  const ana = NAV.filter((n) => MOBIL_ANA.includes(n.href));
  const digerleri = NAV.filter((n) => !MOBIL_ANA.includes(n.href));
  const digerAktif = digerleri.some((n) => aktifMi(pathname, n.href));

  return (
    <>
      {/* MASAÜSTÜ sekmeleri */}
      <div className="relative mx-auto hidden max-w-3xl md:block lg:max-w-5xl">
        <nav className="flex flex-wrap gap-1 px-2 pb-2">
          {NAV.map((n) => {
            const active = aktifMi(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-brand-light font-semibold text-brand-dark"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* MOBİL: içeriğin altına boşluk (sabit çubuk üstünü kapatmasın) */}
      <div aria-hidden className="h-2 md:hidden" />

      {/* PERDE (2026-07-27): "Daha fazla" listesi beyaz zeminde beyaz bir kutu
          olarak açılıyordu; kullanıcı bir şeyin AÇILDIĞINI fark etmiyordu.
          Arkayı karartmak "bir katman açıldı" sinyalinin en güçlü hâli.
          Perdeye dokununca kapanır (mobilde beklenen davranış). */}
      {acik && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setAcik(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
        />
      )}

      {/* MOBİL alt sabit çubuk */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {/* "Daha fazla" sayfa listesi — çubuğun üstünden açılan tepsi */}
        {acik && (
          <div className="-mx-px overflow-hidden rounded-t-2xl border-x border-t border-slate-200 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.12)]">
            {/* Tutamaç + başlık: bunun bir MENÜ olduğunu söyleyen kısım.
                Öncesinde başlıksız bir link ızgarası vardı, sayfa içeriğinden
                ayırt edilemiyordu. */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-900">
                Diğer sayfalar
              </span>
              <span className="text-xs text-slate-400">kapatmak için dokun</span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              {digerleri.map((n) => {
                const active = aktifMi(pathname, n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setAcik(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between border-b border-slate-50 px-4 py-3.5 text-[15px] last:border-0 ${
                      active
                        ? "bg-brand-light font-semibold text-brand-dark"
                        : "text-slate-700 active:bg-slate-100"
                    }`}
                  >
                    <span>{n.label}</span>
                    {/* Ok işareti: satırın tıklanabilir olduğunu gösterir. */}
                    <span aria-hidden className="text-slate-300">
                      ›
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        <nav className="flex items-stretch justify-around px-1 py-1">
          {ana.map((n) => {
            const active = aktifMi(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setAcik(false)}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-lg px-1 py-2 text-center text-xs font-medium ${
                  active ? "bg-brand-light text-brand-dark" : "text-slate-600"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setAcik((v) => !v)}
            aria-expanded={acik}
            className={`flex-1 rounded-lg px-1 py-2 text-center text-xs font-medium ${
              digerAktif || acik ? "bg-brand-light text-brand-dark" : "text-slate-600"
            }`}
          >
            {/* Üç çizgi + metin: "Daha fazla" tek başına buton gibi durmuyordu. */}
            <span aria-hidden className="block text-base leading-none">
              {acik ? "✕" : "☰"}
            </span>
            <span className="mt-0.5 block">{acik ? "Kapat" : "Daha fazla"}</span>
          </button>
        </nav>
      </div>
    </>
  );
}

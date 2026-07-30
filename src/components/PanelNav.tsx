"use client";

// Panel gezinmesi.
// - MASAÜSTÜ: üstte yatay sekmeler.
// - MOBİL: altta SABİT çubuk — 4 ana sekme + "Daha fazla" açılır listesi.
//   Neden hamburger değil: halıcı telefonu tek elle kullanıyor; alt çubuk
//   başparmak menzilinde ve uygulama hissi veriyor. Eski yatay kayan çubukta
//   sekmelerin yarısı ekran dışında kalıyor, kullanıcı fark etmiyordu.
//
// 2026-07-30 (yaşlı kullanıcı turu):
//  - Sayfa listesi tek kaynağa taşındı (@/components/panelSayfalar) — Özet'teki
//    ana-ekran ızgarası aynı listeyi kullanıyor, ikisi ayrışamaz.
//  - Sekmelere İKON eklendi: 50-65 yaş kullanıcı metin taramak yerine şekil
//    tanıyor; ayrıca 13px etiket tek başına küçük kalıyordu.
//  - Dokunma hedefi min 56px'e çıkarıldı (önce ~40px; erişilebilirlik eşiği 48px).
//  - Alt çubukta KISA etiket kullanılıyor ("Canlı Takip" → "Takip"): 375px'te
//    5 sekme × ~75px, tam etiket satır kırıyordu.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PANEL_SAYFALAR,
  MOBIL_ANA,
  aktifMi,
} from "@/components/panelSayfalar";

export default function PanelNav() {
  const pathname = usePathname() ?? "";
  const [acik, setAcik] = useState(false);

  const ana = PANEL_SAYFALAR.filter((n) => MOBIL_ANA.includes(n.href));
  const digerleri = PANEL_SAYFALAR.filter((n) => !MOBIL_ANA.includes(n.href));
  const digerAktif = digerleri.some((n) => aktifMi(pathname, n.href));

  return (
    <>
      {/* MASAÜSTÜ sekmeleri */}
      <div className="relative mx-auto hidden max-w-3xl md:block lg:max-w-5xl">
        <nav className="flex flex-wrap gap-1 px-2 pb-2">
          {PANEL_SAYFALAR.map((n) => {
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
              <span className="text-xs text-slate-500">kapatmak için dokun</span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              {digerleri.map((n) => {
                const active = aktifMi(pathname, n.href);
                const { Icon } = n;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setAcik(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 border-b border-slate-50 px-4 py-3.5 text-[15px] last:border-0 ${
                      active
                        ? "bg-brand-light font-semibold text-brand-dark"
                        : "text-slate-700 active:bg-slate-100"
                    }`}
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{n.label}</span>
                      {/* Başlık tek başına ne olduğunu söylemiyor ("Mutabakat"). */}
                      <span className="block text-xs text-slate-500">
                        {n.aciklama}
                      </span>
                    </span>
                    {/* Ok işareti: satırın tıklanabilir olduğunu gösterir. */}
                    <span aria-hidden className="text-slate-400">
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
            const { Icon } = n;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setAcik(false)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-center text-xs font-medium ${
                  active ? "bg-brand-light text-brand-dark" : "text-slate-600"
                }`}
              >
                <Icon size={21} />
                <span className="leading-tight">{n.kisa ?? n.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setAcik((v) => !v)}
            aria-expanded={acik}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-center text-xs font-medium ${
              digerAktif || acik ? "bg-brand-light text-brand-dark" : "text-slate-600"
            }`}
          >
            {/* Üç çizgi + metin: "Daha fazla" tek başına buton gibi durmuyordu. */}
            <span aria-hidden className="text-xl leading-none">
              {acik ? "✕" : "☰"}
            </span>
            <span className="leading-tight">{acik ? "Kapat" : "Diğer"}</span>
          </button>
        </nav>
      </div>
    </>
  );
}

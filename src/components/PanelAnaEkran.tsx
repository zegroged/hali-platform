// Panel ana-ekran ızgarası (2026-07-30) — MOBİLDE panelin keşif sorunu.
//
// SORUN (ölçüldü): panelde 11 sayfa var, mobil alt çubukta yalnız 4'ü duruyor;
// kalan 7'si "Daha fazla" menüsünün içinde. Kullanıcı kitlesi 50-65 yaş ve
// gizli olanı aramıyor — canlıda 21 işletmenin 19'unda tek fiyat kalemi var,
// çünkü "Profil & Fiyat" o gizli 7'nin içinde ve bir daha hiç açılmamış.
//
// ÇÖZÜM: giriş sonrası ilk gördüğü sayfaya, telefon ana ekranı gibi büyük
// ikonlu kart ızgarası. Menüyü keşfetmesi gerekmiyor, hepsi önünde.
// Masaüstünde gizli — orada 11 sekmenin hepsi zaten başlıkta görünüyor.

import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { PANEL_SAYFALAR } from "@/components/panelSayfalar";

export default function PanelAnaEkran() {
  // Özet'in kendisi listede yok — kullanıcı zaten o sayfada.
  const sayfalar = PANEL_SAYFALAR.filter((s) => s.href !== "/panel");

  return (
    <section className="md:hidden" aria-labelledby="panel-sayfalar-baslik">
      <div className="flex items-center justify-between">
        <h2
          id="panel-sayfalar-baslik"
          className="text-sm font-semibold text-slate-900"
        >
          Panelin bölümleri
        </h2>
        <span className="text-xs text-slate-500">dokunup aç</span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {sayfalar.map(({ href, label, aciklama, Icon }) => (
          <Link
            key={href}
            href={href}
            // min-h-[112px]: dokunma hedefi erişilebilirlik eşiğinin (48px) çok
            // üstünde — titreyen elle yanlış tuşa basma ihtimalini düşürür.
            className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm active:bg-slate-50"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light text-brand-dark">
              <Icon size={22} />
            </span>
            <span>
              <span className="flex items-center gap-0.5">
                <span className="text-sm font-semibold text-slate-900">
                  {label}
                </span>
                <IconChevronRight size={14} className="text-slate-400" />
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                {aciklama}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import BolgeSecici from "@/components/BolgeSecici";
import { PendingButton } from "@/components/PendingButton";

// BÖLGE DÜZENLEME KUTUSU (2026-07-28 denetim bulgusu).
//
// Bölge yalnız hesap AÇILIŞINDA yazılabiliyordu — sonradan atama, değiştirme
// ya da kaldırma yolu yoktu. Bölge sisteminden ÖNCE açılmış komisyoncular
// bu yüzden sonsuza dek bölgesiz kalırdı.
//
// Kapalı dururken mevcut bölgeyi özet olarak gösterir; açılınca seçiciyi çizer.
// Gönderilen ilçe kümesi bölgenin TAMAMIDIR (seçilmeyenler silinir).

type Props = {
  agentId: string;
  action: (formData: FormData) => void | Promise<void>;
  mevcut: { city: string; district: string }[];
  ilceAdlari: Record<string, string[]>;
  doluluk: Record<string, number>;
  /** Baş komisyoncu kendi ili dışına atayamasın diye kısıt (opsiyonel). */
  sadeceIl?: string;
  /** ÇOK İL modu (baş komisyoncu): kaydetmek yalnız SEÇİLEN ili tazeler,
   *  diğer iller korunur; her il ayrıca tek tek kaldırılabilir. */
  cokIl?: boolean;
  /** Çok-il modunda bir ili tamamen kaldıran server action. */
  ilKaldirAction?: (formData: FormData) => void | Promise<void>;
};

export default function BolgeDuzenle({
  agentId,
  action,
  mevcut,
  ilceAdlari,
  doluluk,
  sadeceIl,
  cokIl = false,
  ilKaldirAction,
}: Props) {
  const [acik, setAcik] = useState(false);
  // İl bazında grupla — çok-il modunda birden fazla satır çıkar.
  const iller = Array.from(new Set(mevcut.map((t) => t.city)));
  const satirlar = iller.map((il) => ({
    il,
    ilceler: mevcut.filter((t) => t.city === il).map((t) => t.district),
  }));
  const ozet =
    satirlar.length > 0
      ? satirlar.map((r) => `${r.il} — ${r.ilceler.join(", ")}`).join(" · ")
      : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600">Bölge</p>
          <p className="mt-0.5 text-sm text-slate-800">
            {ozet ?? (
              <span className="text-amber-700">
                Atanmamış — bu komisyoncu hiçbir bölgeden sorumlu görünmüyor
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAcik((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {acik ? "Vazgeç" : ozet ? (cokIl ? "İl ekle / değiştir" : "Değiştir") : "Bölge ata"}
        </button>
      </div>

      {/* Çok-il modunda her il ayrı satır + tek tıkla kaldırma. */}
      {cokIl && ilKaldirAction && satirlar.length > 0 && (
        <ul className="mt-2 space-y-1">
          {satirlar.map((r) => (
            <li
              key={r.il}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
            >
              <span className="min-w-0 text-xs text-slate-700">
                <strong>{r.il}</strong> — {r.ilceler.join(", ")}
              </span>
              <form action={ilKaldirAction}>
                <input type="hidden" name="agentId" value={agentId} />
                <input type="hidden" name="city" value={r.il} />
                <PendingButton className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  İli kaldır
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {acik && (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="agentId" value={agentId} />
          <BolgeSecici
            ilceAdlari={ilceAdlari}
            doluluk={doluluk}
            sadeceIl={sadeceIl}
            zorunlu={false}
          />
          <p className="text-xs text-slate-500">
            {cokIl ? (
              <>
                Kaydettiğinde <strong>yalnız seçtiğin il</strong> güncellenir —
                diğer iller olduğu gibi kalır. Yeni il eklemek için o ili seçip
                ilçelerini işaretle ve kaydet.
              </>
            ) : (
              <>
                Seçtiklerin bölgenin <strong>tamamı</strong> olur — seçmediğin
                ilçeler kaldırılır. Hiçbir şey seçmeden kaydedersen bölge
                tamamen silinir.
              </>
            )}
          </p>
          <PendingButton className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Bölgeyi kaydet
          </PendingButton>
        </form>
      )}
    </div>
  );
}

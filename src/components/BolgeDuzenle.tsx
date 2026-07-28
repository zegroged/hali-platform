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
};

export default function BolgeDuzenle({
  agentId,
  action,
  mevcut,
  ilceAdlari,
  doluluk,
  sadeceIl,
}: Props) {
  const [acik, setAcik] = useState(false);
  const ozet =
    mevcut.length > 0
      ? `${mevcut[0].city} — ${mevcut.map((t) => t.district).join(", ")}`
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
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {acik ? "Vazgeç" : ozet ? "Değiştir" : "Bölge ata"}
        </button>
      </div>

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
            Seçtiklerin bölgenin <strong>tamamı</strong> olur — seçmediğin ilçeler
            kaldırılır. Hiçbir şey seçmeden kaydedersen bölge tamamen silinir.
          </p>
          <PendingButton className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Bölgeyi kaydet
          </PendingButton>
        </form>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { PendingButton } from "@/components/PendingButton";
import MoneyInput from "@/components/MoneyInput";

// KASA KALEM FORMU (2026-07-28 yeniden yazıldı — kullanıcı geri bildirimi).
//
// ÖNCEKİ HALİNİN İKİ HATASI:
// 1) Gelir/gider seçilince ekrandaki YAZILAR DEĞİŞMİYORDU. "Ne için?" gibi
//    gidere göre yazılmış etiketler ek gelir seçilince de öylece duruyordu.
// 2) TEKRAR seçenekleri BİRBİRİNİ DIŞLAMIYORDU: "her kaç günde bir?" ve "her
//    ayın kaçında?" kutuları yan yana açıktı. "2 günde bir" diyen kullanıcı
//    ikinci kutuya ne yazacağını bilemiyordu — çünkü yazacak bir şey YOK.
//
// ÇÖZÜM: form istemci bileşeni oldu. Tür seçimi bütün metinleri değiştiriyor;
// tekrar ise TEK bir seçim (yok / gün / ay) ve yalnız seçilenin kutusu çiziliyor.
// Sunucu aksiyonunun beklediği alan adları AYNEN korundu (kind, category, label,
// amount, date, note, everyDays, monthDay) — aksiyon değişmedi.

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  kategoriOnerileri: string[];
  bugun: string;
};

type Tur = "EXPENSE" | "INCOME";
type Tekrar = "yok" | "gun" | "ay";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
const lbl = "mb-1 block text-xs font-medium text-slate-600";

// Tür değişince değişen bütün metinler tek yerde — ekranda tutarsızlık kalmasın.
const METIN = {
  EXPENSE: {
    neIcinLabel: "Ne için ödedin?",
    neIcinPlaceholder: "Ör. Ahmet'in maaşı / Omo 5kg x4",
    kategoriPlaceholder: "Kendin yaz — ör. Deterjan, Maaş, Kira, Yakıt",
    tutarLabel: "Ne kadar ödedin? (TL)",
    tarihLabel: "Ne zaman ödedin?",
    tekrarBaslik: "Bu gider tekrar ediyor mu?",
    gunOrnek: "Ör. deterjan her 3 günde bir",
    ayOrnek: "Ör. kira her ayın 5'inde",
    tekrarAciklama:
      "Tekrar eden gideri bir kez tanımla — sistem vadesi geldikçe kendisi işler, bir daha girmen gerekmez.",
    kaydet: "Gideri kaydet",
  },
  INCOME: {
    neIcinLabel: "Ne için aldın?",
    neIcinPlaceholder: "Ör. Kilim satışı / Halı tamiri / Hurda satışı",
    kategoriPlaceholder: "Kendin yaz — ör. Kilim satışı, Tamir, Kira geliri",
    tutarLabel: "Ne kadar aldın? (TL)",
    tarihLabel: "Ne zaman aldın?",
    tekrarBaslik: "Bu gelir tekrar ediyor mu?",
    gunOrnek: "Ör. her 15 günde bir gelen ödeme",
    ayOrnek: "Ör. dükkân üstü kirası her ayın 1'inde",
    tekrarAciklama:
      "Tekrar eden geliri bir kez tanımla — sistem vadesi geldikçe kendisi işler, bir daha girmen gerekmez.",
    kaydet: "Geliri kaydet",
  },
} as const;

export default function LedgerEntryForm({
  action,
  kategoriOnerileri,
  bugun,
}: Props) {
  const [tur, setTur] = useState<Tur>("EXPENSE");
  const [tekrar, setTekrar] = useState<Tekrar>("yok");
  const t = METIN[tur];

  const turBtn = (deger: Tur, isaret: string, metin: string, renk: string) => (
    <button
      type="button"
      onClick={() => setTur(deger)}
      aria-pressed={tur === deger}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
        tur === deger ? renk : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span aria-hidden className="text-base">
        {isaret}
      </span>
      {metin}
    </button>
  );

  const tekrarBtn = (deger: Tekrar, metin: string) => (
    <button
      type="button"
      onClick={() => setTekrar(deger)}
      aria-pressed={tekrar === deger}
      className={`rounded-lg border px-3 py-2 text-sm transition ${
        tekrar === deger
          ? "border-brand bg-brand-light font-medium text-brand-dark"
          : "border-slate-300 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {metin}
    </button>
  );

  return (
    <form
      action={action}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <h2 className="font-semibold text-slate-900">+ Kalem Ekle</h2>

      {/* Sunucuya giden asıl değerler — görünmez, butonlar bunları besliyor. */}
      <input type="hidden" name="kind" value={tur} />
      {tekrar === "yok" && <input type="hidden" name="everyDays" value="" />}
      {tekrar === "yok" && <input type="hidden" name="monthDay" value="" />}
      {tekrar === "gun" && <input type="hidden" name="monthDay" value="" />}
      {tekrar === "ay" && <input type="hidden" name="everyDays" value="" />}

      {/* TÜR */}
      <div>
        <label className={lbl}>Bu para giriyor mu, çıkıyor mu?</label>
        <div className="grid grid-cols-2 gap-2">
          {turBtn(
            "EXPENSE",
            "−",
            "Gider (para çıktı)",
            "border-red-400 bg-red-50 text-red-700",
          )}
          {turBtn(
            "INCOME",
            "+",
            "Ek gelir (para girdi)",
            "border-green-500 bg-green-50 text-green-700",
          )}
        </div>
        {tur === "INCOME" && (
          <p className="mt-1.5 text-xs text-slate-500">
            Siparişlerden gelen para zaten otomatik işleniyor. Buraya yalnız
            sipariş dışı gelirleri yaz.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Kategori</label>
          <input
            name="category"
            list="kasa-kategoriler"
            placeholder={t.kategoriPlaceholder}
            className={inp}
          />
          <datalist id="kasa-kategoriler">
            {kategoriOnerileri.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-500">
            İstediğin adı yazabilirsin; boş bırakırsan &quot;Diğer&quot; olur.
          </p>
        </div>

        <div>
          <label className={lbl}>{t.neIcinLabel}</label>
          <input
            name="label"
            required
            placeholder={t.neIcinPlaceholder}
            className={inp}
          />
        </div>
        <div>
          <label className={lbl}>{t.tutarLabel}</label>
          <MoneyInput name="amount" required className={inp} />
        </div>
        <div>
          <label className={lbl}>{t.tarihLabel}</label>
          <input type="date" name="date" defaultValue={bugun} className={inp} />
        </div>
        <div>
          <label className={lbl}>Not (istersen)</label>
          <input name="note" className={inp} />
        </div>
      </div>

      {/* TEKRAR — TEK SEÇİM. Eskiden iki kutu birden açıktı ve "2 günde bir"
          diyen kullanıcı ay kutusuna ne yazacağını bilemiyordu. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-700">{t.tekrarBaslik}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {tekrarBtn("yok", "Hayır, tek seferlik")}
          {tekrarBtn("gun", "Her birkaç günde bir")}
          {tekrarBtn("ay", "Her ayın belli bir günü")}
        </div>

        {tekrar === "gun" && (
          <div className="mt-3 max-w-xs">
            <label className={lbl}>Kaç günde bir tekrar etsin?</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Her</span>
              <input
                name="everyDays"
                inputMode="numeric"
                required
                placeholder="3"
                className={`${inp} w-20 text-center`}
              />
              <span className="text-sm text-slate-500">günde bir</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t.gunOrnek}</p>
          </div>
        )}

        {tekrar === "ay" && (
          <div className="mt-3 max-w-xs">
            <label className={lbl}>Ayın kaçında tekrar etsin?</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Her ayın</span>
              <input
                name="monthDay"
                inputMode="numeric"
                required
                placeholder="5"
                className={`${inp} w-20 text-center`}
              />
              <span className="text-sm text-slate-500">günü</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {t.ayOrnek} · 1–28 arası yazabilirsin (her ayda var olsun diye).
            </p>
          </div>
        )}

        {tekrar !== "yok" && (
          <p className="mt-2 text-xs text-slate-500">{t.tekrarAciklama}</p>
        )}
      </div>

      <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
        {t.kaydet}
      </PendingButton>
    </form>
  );
}

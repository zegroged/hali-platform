"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { PendingButton } from "@/components/PendingButton";
import { fotoKucult, boyutYaz } from "@/lib/fotoKucult";

/**
 * Şoför alım/teslim formu: fotoğraf ZORUNLU ama eksikse TAM-EKRAN hata yerine
 * alanın hemen ALTINDA net bir uyarı gösterir (gönderimi engeller). Sunucu
 * tarafı da ayrıca zorunlu (arayüz atlatılırsa sebebini yazarak /sofor'a döner).
 *
 * 2026-08-11 (ikiz denetimi) — iki ekleme:
 *  · Kare gönderilmeden ÖNCE 1600 px'e küçültülür (mobil ikiziyle aynı).
 *  · Yükleme uzarsa ekranda ne olduğu YAZAR. Öncesinde `otoYenileme={false}`
 *    doğru sebeple konmuştu ama yerine hiçbir şey konmamıştı: mobil şebekede
 *    POST asılırsa şoför süresiz "İşleniyor…" ekranında kalıyordu
 *    (DEVIR §4.87-D KURAL 1'in doğrudan ihlali).
 */
export function PhotoForm({
  action,
  orderId,
  photoLabel,
  errorMessage,
  buttonLabel,
  children,
  footer,
}: {
  action: (fd: FormData) => void | Promise<void>;
  orderId: string;
  photoLabel: React.ReactNode;
  errorMessage: string;
  buttonLabel: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const fid = `foto-${orderId}`;

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f) {
      setBilgi(null);
      return;
    }
    setHazirlaniyor(true);
    try {
      const kucuk = await fotoKucult(f);
      if (kucuk !== f) {
        // Küçültülmüş kareyi input'a GERİ KOY: form gönderimi input'tan okur.
        // ⚠️ `input.files = ...` eski iOS/WebView'de TypeError fırlatır. Yakalanmazsa
        // küçültme yarıda kalır, üstelik kullanıcı hiçbir şey görmez ve dosya
        // 8 MB sınırına takılır. Yakalanınca orijinal gönderilir — fotoğrafın
        // hiç gitmemesindense büyük gitmesi yeğdir (fotoğrafsız halı alınamıyor).
        try {
          const dt = new DataTransfer();
          dt.items.add(kucuk);
          input.files = dt.files;
          setBilgi(`Fotoğraf hazır (${boyutYaz(f.size)} → ${boyutYaz(kucuk.size)}).`);
        } catch {
          setBilgi(`Fotoğraf hazır (${boyutYaz(f.size)}) — küçültülemedi, olduğu gibi gönderilecek.`);
        }
      } else {
        setBilgi(`Fotoğraf hazır (${boyutYaz(f.size)}).`);
      }
    } finally {
      setHazirlaniyor(false);
    }
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const input = e.currentTarget.elements.namedItem(
          "photo",
        ) as HTMLInputElement | null;
        if (!input?.files?.length) {
          e.preventDefault(); // gönderme — tam-ekran hata çıkmasın
          setErr(errorMessage);
          return;
        }
        if (hazirlaniyor) {
          e.preventDefault();
          setErr("Fotoğraf hazırlanıyor, bir saniye bekle ve tekrar bas.");
          return;
        }
        setErr(null);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      {children}
      <label htmlFor={fid} className="block text-xs font-medium text-slate-600">
        {photoLabel}
      </label>
      <input
        id={fid}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={dosyaSecildi}
        className="mt-1 w-full text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
      />
      {hazirlaniyor && (
        <p className="text-xs text-slate-500">Fotoğraf küçültülüyor…</p>
      )}
      {bilgi && !hazirlaniyor && (
        <p className="text-xs text-slate-500">{bilgi}</p>
      )}
      {err && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {err}
        </p>
      )}
      <UzuyorUyarisi />
      {/* otoYenileme=false ŞART: bu form dosya yüklüyor ve 10 sn'lik yenileme
          yüklemeyi ortasında kesiyordu (2026-08-08). Yerine yukarıdaki
          "uzuyor" uyarısı kondu — sessiz bekleme bırakmıyoruz. */}
      <PendingButton
        otoYenileme={false}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        {buttonLabel}
      </PendingButton>
      {footer}
    </form>
  );
}

/**
 * 🔴 GERÇEKTEN ÇALIŞAN "YÜKLEME UZUYOR" UYARISI (2026-08-11).
 *
 * İlk yazımda sayaç `useRef` ile tetikleniyordu ve efekt bağımlılığı
 * değişmediği için `setTimeout` HİÇ kurulmuyordu — yani uyarı ölü koddu.
 * Doğrulama denetimi yakaladı ve haklı olarak "deponun pil düğmesi kalıbının
 * aynısı" dedi (sessizce hiçbir şey yapmayan düzeltme).
 *
 * Doğrusu: `useFormStatus` YALNIZ form içindeki bir ALT bileşende çalışır.
 * Gönderim başlayınca bu bileşen `pending=true` görür ve sayaç kurulur;
 * gönderim bitince React onu sıfırlar.
 */
function UzuyorSayaci() {
  const [uzuyor, setUzuyor] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setUzuyor(true), 25_000);
    return () => clearTimeout(t);
  }, []);
  if (!uzuyor) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      Yükleme uzun sürüyor — şebeke yavaş olabilir.{" "}
      <strong>Sayfayı kapatma;</strong> kapatırsan fotoğraf gitmez ve halı
      alınmış sayılmaz. Bir dakika sonra hâlâ dönmüyorsa sayfayı yenileyip
      tekrar dene.
    </p>
  );
}

function UzuyorUyarisi() {
  const { pending } = useFormStatus();
  // Sayaç yalnız gönderim sürerken YAŞAR: bitince bileşen sökülür, bir sonraki
  // gönderimde sıfırdan başlar (eski hâlde bayrak hiç sıfırlanmıyordu).
  return pending ? <UzuyorSayaci /> : null;
}

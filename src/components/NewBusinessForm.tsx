import { createBusinessByAdmin } from "@/app/admin/actions";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand";
const lbl = "mb-1 block text-xs font-medium text-slate-600";

// Doğrulamasız işletme açma formu — /admin/yeni ve /destek aynı formu kullanır;
// yönlendirme/yetki farkları sunucu aksiyonunda role göre çözülür.
export default function NewBusinessForm() {
  return (
    <form
      action={createBusinessByAdmin}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div>
        <label htmlFor="businessName" className={lbl}>
          İşletme adı
        </label>
        <input id="businessName" name="businessName" required className={inp} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ownerName" className={lbl}>
            Yetkili ad soyad
          </label>
          <input id="ownerName" name="ownerName" required className={inp} />
        </div>
        <div>
          <label htmlFor="phone" className={lbl}>
            Telefon (giriş için)
          </label>
          <input
            id="phone"
            name="phone"
            placeholder="05xxxxxxxxx"
            required
            className={inp}
          />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={lbl}>
          E-posta
        </label>
        <input id="email" name="email" type="email" required className={inp} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={lbl}>
            İl
          </label>
          <input
            id="city"
            name="city"
            defaultValue="İstanbul"
            required
            className={inp}
          />
        </div>
        <div>
          <label htmlFor="district" className={lbl}>
            İlçe
          </label>
          <input id="district" name="district" required className={inp} />
        </div>
      </div>
      <div>
        <label htmlFor="taxNumber" className={lbl}>
          Vergi / T.C. kimlik no{" "}
          <span className="text-slate-400">(11 hane TC veya 10 hane VKN)</span>
        </label>
        <input id="taxNumber" name="taxNumber" className={inp} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="pricePerM2" className={lbl}>
            m² fiyatı (TL)
          </label>
          <input
            id="pricePerM2"
            name="pricePerM2"
            type="number"
            min="0"
            placeholder="45"
            className={inp}
          />
        </div>
        <div>
          <label htmlFor="minDays" className={lbl}>
            Teslim min (gün)
          </label>
          <input
            id="minDays"
            name="minDays"
            type="number"
            min="1"
            placeholder="2"
            className={inp}
          />
        </div>
        <div>
          <label htmlFor="maxDays" className={lbl}>
            Teslim max (gün)
          </label>
          <input
            id="maxDays"
            name="maxDays"
            type="number"
            min="1"
            placeholder="4"
            className={inp}
          />
        </div>
      </div>
      <button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
        İşletmeyi Oluştur
      </button>
      <p className="text-xs text-slate-400">
        Oluşturunca geçici şifre gösterilir — sahibine ilet, girişten sonra
        panelden değiştirebilir. Fotoğraf ve şoför işletme panelinden eklenir.
      </p>
    </form>
  );
}

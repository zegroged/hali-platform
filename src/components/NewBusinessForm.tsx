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
            Telefon (iletişim)
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
          E-posta (giriş için)
        </label>
        <input id="email" name="email" type="email" required className={inp} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="username" className={lbl}>
            Kullanıcı adı{" "}
            <span className="text-slate-400">(boşsa ilk girişte kendisi seçer)</span>
          </label>
          <input
            id="username"
            name="username"
            maxLength={30}
            placeholder="orn: mehmet.hali"
            autoComplete="off"
            className={inp}
          />
        </div>
        <div>
          <label htmlFor="password" className={lbl}>
            Şifre (giriş için)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={inp}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Sahibi e-postası (veya kullanıcı adı) + bu şifreyle giriş yapar — ikisini
        de ona sen ilet. En az 8 karakter.
      </p>
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
      <div>
        <label htmlFor="photos" className={lbl}>
          İşletme fotoğrafları{" "}
          <span className="text-slate-400">(yayın için en az 1 gerekli)</span>
        </label>
        <input
          id="photos"
          name="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-dark"
        />
        <p className="mt-1 text-xs text-slate-500">
          jpg/png/webp · adet başı ≤5MB, toplam ≤8MB. Sonradan panelden de
          eklenebilir.
        </p>
      </div>

      {/* Yayın şartı: foto + ≥1 şoför. Şoför burada da açılabilsin ki işletme
          tek ekranda yayına hazır olsun. Alanlardan biri dolarsa hepsi istenir. */}
      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-medium text-slate-600">
          İlk şoför (opsiyonel — yayın için en az 1 şoför şart)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="driverName" className={lbl}>
              Şoför ad soyad
            </label>
            <input id="driverName" name="driverName" className={inp} />
          </div>
          <div>
            <label htmlFor="driverPhone" className={lbl}>
              Şoför telefonu
            </label>
            <input
              id="driverPhone"
              name="driverPhone"
              placeholder="05xxxxxxxxx"
              className={inp}
            />
          </div>
          <div>
            <label htmlFor="driverUsername" className={lbl}>
              Şoför kullanıcı adı (giriş için)
            </label>
            <input
              id="driverUsername"
              name="driverUsername"
              maxLength={30}
              placeholder="orn: ahmet.sofor"
              autoComplete="off"
              className={inp}
            />
          </div>
          <div>
            <label htmlFor="driverPassword" className={lbl}>
              Şoför şifresi
            </label>
            <input
              id="driverPassword"
              name="driverPassword"
              type="password"
              minLength={8}
              autoComplete="new-password"
              className={inp}
            />
          </div>
        </div>
      </fieldset>

      <button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
        İşletmeyi Oluştur
      </button>
      <p className="text-xs text-slate-400">
        Giriş bilgilerini (e-posta/kullanıcı adı + şifre) sahibine ve şoförüne
        sen iletirsin; girişten sonra panelden değiştirebilirler.
      </p>
    </form>
  );
}

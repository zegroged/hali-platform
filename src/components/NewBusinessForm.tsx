import { createBusinessByAdmin } from "@/app/admin/actions";
import CityDistrictSelect from "@/components/CityDistrictSelect";

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
          İşletme adı{" "}
          <span className="text-slate-400">(boşsa otomatik ad verilir)</span>
        </label>
        <input id="businessName" name="businessName" className={inp} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ownerName" className={lbl}>
            Yetkili ad soyad{" "}
            <span className="text-slate-400">(opsiyonel)</span>
          </label>
          <input id="ownerName" name="ownerName" className={inp} />
        </div>
        <div>
          <label htmlFor="phone" className={lbl}>
            Telefon (iletişim){" "}
            <span className="text-slate-400">(boşsa geçici üretilir)</span>
          </label>
          <input
            id="phone"
            name="phone"
            placeholder="05xx… veya sabit hat 0342…"
            className={inp}
          />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={lbl}>
          E-posta (giriş için){" "}
          <span className="text-slate-400">(opsiyonel — boşsa kullanıcı adı üretilir)</span>
        </label>
        <input id="email" name="email" type="email" className={inp} />
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
            Şifre (giriş için){" "}
            <span className="text-slate-400">(boşsa geçici şifre üretilir)</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            className={inp}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Giriş bilgileri (e-posta/kullanıcı adı + şifre) oluşturma sonrası ekranda
        gösterilir — sahibine sen iletirsin. Boş bıraktıkların otomatik üretilir.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Zorunlu DEĞİL (bilinçli karar) ama boşsa işletme yayına alınmaz —
            il/ilçesiz kayıt keşifte ve şehir sayfalarında zaten çıkmıyor. */}
        <CityDistrictSelect selectClass={inp} labelClass={lbl} />
      </div>
      <p className="-mt-2 text-xs text-amber-700">
        İl/ilçe boş bırakılabilir ama <strong>o işletme yayına alınmaz</strong> —
        il/ilçesi olmayan kayıt aramada ve şehir sayfalarında çıkmaz. Sahibi
        panelden seçince kendiliğinden yayına girer.
      </p>
      <div>
        <label htmlFor="taxNumber" className={lbl}>
          Vergi / T.C. kimlik no{" "}
          <span className="text-slate-400">(11 hane TC veya 10 hane VKN)</span>
        </label>
        <input id="taxNumber" name="taxNumber" className={inp} />
      </div>

      <div>
        <label htmlFor="agentCode" className={lbl}>
          Komisyoncu kodu <span className="text-slate-400">(tek kullanımlık, varsa)</span>
        </label>
        <input
          id="agentCode"
          name="agentCode"
          placeholder="HYK-1234"
          className={inp}
        />
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
          <span className="text-slate-400">
            (opsiyonel — yayına girmesi için en az 1 gerekir)
          </span>
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
          jpg/png/webp · adet başı ≤5MB, bu formda TOPLAM ≤8MB. Dosya seçerken
          Ctrl ile aynı kategoriye çok sayıda fotoğraf seçebilirsin; daha
          fazlası için oluşturduktan sonra panelden sınırsız eklenir.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="logo" className={lbl}>
            Logo <span className="text-slate-400">(opsiyonel, tek dosya)</span>
          </label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-light file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-dark"
          />
        </div>
        <div>
          <label htmlFor="photosBefore" className={lbl}>
            Öncesi fotoğrafları{" "}
            <span className="text-slate-400">(opsiyonel)</span>
          </label>
          <input
            id="photosBefore"
            name="photosBefore"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
        <div>
          <label htmlFor="photosAfter" className={lbl}>
            Sonrası fotoğrafları{" "}
            <span className="text-slate-400">(opsiyonel)</span>
          </label>
          <input
            id="photosAfter"
            name="photosAfter"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
      </div>

      {/* Şoför yayına değil SİPARİŞE şart (admin işletmesi şoförsüz yayınlanır,
          sipariş API'si şoförsüzken 409 döner). Alanlardan biri dolarsa hepsi istenir. */}
      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-medium text-slate-600">
          İlk şoför (opsiyonel — sipariş alabilmek için gerekir)
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

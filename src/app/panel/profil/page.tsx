import { getCurrentBusiness, completenessChecklist } from "@/lib/panel";
import {
  updateProfileBasics,
  setWorkingHours,
  addPricingItem,
  removePricingItem,
  addServiceArea,
  removeServiceArea,
  removePhoto,
} from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { PendingButton } from "@/components/PendingButton";
import { PhotoUpload } from "@/components/PhotoUpload";
import CityDistrictSelect from "@/components/CityDistrictSelect";
import { districtsOfCity } from "@/lib/cities";
import { IconX, IconCheck } from "@/components/icons";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand";
// Eksik zorunlu alan: kırmızı çerçeve + kırmızımsı zemin (nereyi dolduracağı belli olsun)
const inpMissing =
  "w-full rounded-lg border-2 border-red-400 bg-red-50/40 px-3 py-2 text-sm focus:border-brand";
const lbl = "text-xs font-medium text-slate-500";
const reqBadge = (
  <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
    YAYIN İÇİN GEREKLİ
  </span>
);

const UNIT_LABEL: Record<string, string> = {
  PER_M2: "/m²",
  PER_PIECE: "/adet",
  FLAT: "sabit",
};

export default async function PanelProfile({
  searchParams,
}: {
  searchParams: Promise<{
    hata?: string;
    kaydedildi?: string;
    odeme?: string;
  }>;
}) {
  const b = await getCurrentBusiness();
  if (!b) return null;
  const { hata, kaydedildi, odeme } = await searchParams;
  // Abonelik ödeme adımından yönlendirme: eksik alanı net söyle.
  const odemeUyari =
    odeme === "fatura"
      ? "Aboneliğe geçmeden önce Fatura Bilgileri'ni (ünvan + vergi dairesi + fatura adresi) doldurun — size bu bilgilerle fatura kesilecek."
      : odeme === "vergino"
        ? "Aboneliğe geçmeden önce vergi / T.C. kimlik numaranızı girin."
        : odeme === "cep"
          ? "Otomatik ödeme talimatı için geçerli bir CEP numarası gerekir (banka doğrulaması SMS ile gelir). Numaralar bölümüne 05xx ile başlayan cep numaranızı ekleyin."
          : null;

  const hours = (b.workingHours ?? {}) as Record<
    string,
    { open: string; close: string } | null
  >;
  const main = b.pricing.filter((p) => !p.isAddon);
  const addons = b.pricing.filter((p) => p.isAddon);

  // Yayına çıkmak için eksik kalan alanlar — kullanıcı NEYİ dolduracağını görsün.
  const checklist = completenessChecklist(b);
  const missing = checklist.filter((c) => !c.done);
  const taxMissing = !b.taxNumber;
  // Abonelik faturası için ünvan + vergi dairesi zorunlu (ödeme kapısı kontrol eder).
  const billingMissing = !b.billingTitle || !b.taxOffice || !b.billingAddress;
  const daysMissing = !(b.deliveryEstimateMinDays && b.deliveryEstimateMaxDays);

  return (
    <div className="space-y-8">
      {kaydedildi && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <IconCheck size={16} /> {kaydedildi} kaydedildi.
        </p>
      )}
      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {hata}
        </p>
      )}
      {odemeUyari && (
        <p
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          {odemeUyari}
        </p>
      )}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Profil &amp; Fiyat
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          İşletme bilgilerin, çalışma saatlerin, fiyatların ve hizmet
          bölgelerin.
        </p>
      </div>

      {/* Eksik alanlar özeti — yayına çıkma şartları tek bakışta. */}
      {missing.length > 0 ? (
        <section className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <h2 className="font-semibold text-red-800">
            Yayına çıkmak için {missing.length} eksik var
          </h2>
          <p className="mt-1 text-sm text-red-700">
            Aşağıdakiler tamamlanmadan işletmen müşterilere görünmez.
          </p>
          <ul className="mt-2 space-y-1">
            {missing.map((m) => (
              <li key={m.label} className="text-sm font-medium text-red-800">
                ✗ {m.label}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-emerald-800">
            <IconCheck size={16} /> Profil eksiksiz — yayın şartları tamam.
          </h2>
        </section>
      )}

      {/* Temel bilgiler */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Temel Bilgiler</h2>
        <form action={updateProfileBasics} className="space-y-3">
          <div>
            <label className={lbl}>İşletme adı</label>
            <input name="name" defaultValue={b.name} className={inp} />
          </div>
          <div>
            <label className={lbl}>Açıklama</label>
            <textarea
              name="description"
              defaultValue={b.description ?? ""}
              rows={2}
              className={inp}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CityDistrictSelect
              defaultCity={b.city}
              defaultDistrict={b.district}
              selectClass={inp}
              labelClass={lbl}
              required
            />
          </div>
          <div>
            <label className={lbl}>Adres</label>
            <input name="address" defaultValue={b.address} className={inp} />
          </div>
          {/* İLETİŞİM NUMARALARI — müşteri vitrininde "GSM & WhatsApp" ve
              "Sabit Hat" olarak gruplu gösterilir. Birincil GSM zorunlu:
              sipariş SMS'leri ve WhatsApp butonu bu numarayla çalışır. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">
              İletişim Numaraları
            </p>
            <p className="mb-3 mt-0.5 text-xs text-slate-500">
              GSM numaraları müşteriye WhatsApp butonuyla gösterilir; sipariş
              SMS bildirimleri birincil GSM&apos;e gider. Sabit hat profilde
              ayrı satırda görünür.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>GSM &amp; WhatsApp (birincil)</label>
                <input
                  name="phone"
                  defaultValue={b.phone}
                  type="tel"
                  maxLength={11}
                  placeholder="05xx xxx xx xx"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>GSM &amp; WhatsApp (2. numara)</label>
                <input
                  name="gsmPhone2"
                  defaultValue={b.gsmPhone2 ?? ""}
                  type="tel"
                  maxLength={11}
                  placeholder="Varsa ikinci cep numarası"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Telefon (Sabit Hat)</label>
                <input
                  name="landlinePhone"
                  defaultValue={b.landlinePhone ?? ""}
                  type="tel"
                  maxLength={11}
                  placeholder="0324 320 16 42"
                  className={inp}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>
                Vergi / T.C. kimlik no{taxMissing && reqBadge}
              </label>
              <input
                name="taxNumber"
                defaultValue={b.taxNumber ?? ""}
                placeholder="11 hane T.C. veya 10 hane vergi no"
                className={taxMissing ? inpMissing : inp}
              />
              <p className="mt-1 text-xs text-slate-500">
                Şahıs işletmesi 11 haneli T.C. kimlik, şirket 10 haneli vergi
                numarası girer. Müşteriye yalnız şirket vergi numarası gösterilir.
              </p>
            </div>
          </div>

          {/* FATURA BİLGİLERİ — abonelik ödemesi öncesi zorunlu (platform sana
              bu bilgilerle fatura keser). Ünvan/vergi dairesi eksikse ödeme
              adımı buraya yönlendirir. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">
              Fatura Bilgileri{billingMissing && reqBadge}
            </p>
            <p className="mb-3 mt-0.5 text-xs text-slate-500">
              Aboneliğin için sana kesilecek faturada kullanılır. Aboneliğe
              geçmeden önce ünvan, vergi dairesi ve fatura adresi zorunludur.
            </p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Fatura ünvanı (yasal unvan)</label>
                <input
                  name="billingTitle"
                  defaultValue={b.billingTitle ?? ""}
                  placeholder="Örn. Ersan Temizlik Ltd. Şti. / Ahmet Yılmaz"
                  className={billingMissing && !b.billingTitle ? inpMissing : inp}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Vergi dairesi</label>
                  <input
                    name="taxOffice"
                    defaultValue={b.taxOffice ?? ""}
                    placeholder="Örn. Şehitkamil"
                    className={billingMissing && !b.taxOffice ? inpMissing : inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Fatura adresi</label>
                  <input
                    name="billingAddress"
                    defaultValue={b.billingAddress ?? ""}
                    placeholder="Örn. Fevzi Çakmak Mah. No:12, Selçuklu/Konya"
                    className={
                      billingMissing && !b.billingAddress ? inpMissing : inp
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <div>
            <label className={lbl}>Google işletme profili linki (opsiyonel)</label>
            <input
              name="googleProfileUrl"
              type="url"
              defaultValue={b.googleProfileUrl ?? ""}
              placeholder="https://maps.app.goo.gl/... veya g.page/..."
              className={inp}
            />
            <p className="mt-1 text-xs text-slate-500">
              Google Haritalar&apos;daki işletme sayfanın linkini yapıştır —
              müşteriler senin gerçek Google puanına/yorumlarına ulaşır, güven
              artar. (Google Haritalar → işletmen → Paylaş → linki kopyala.)
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>
                Teslim (min gün){daysMissing && reqBadge}
              </label>
              <input
                name="minDays"
                type="number"
                defaultValue={b.deliveryEstimateMinDays ?? ""}
                className={daysMissing ? inpMissing : inp}
              />
            </div>
            <div>
              <label className={lbl}>
                Teslim (max gün){daysMissing && reqBadge}
              </label>
              <input
                name="maxDays"
                type="number"
                defaultValue={b.deliveryEstimateMaxDays ?? ""}
                className={daysMissing ? inpMissing : inp}
              />
            </div>
          </div>
          <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
            Kaydet
          </PendingButton>
        </form>
      </section>

      {/* Çalışma saatleri */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Çalışma Saatleri</h2>
        <form action={setWorkingHours} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Hafta içi açılış</label>
              <input
                name="weekdayOpen"
                type="time"
                defaultValue={hours.mon?.open ?? "09:00"}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Hafta içi kapanış</label>
              <input
                name="weekdayClose"
                type="time"
                defaultValue={hours.mon?.close ?? "19:00"}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Cumartesi açılış</label>
              <input
                name="satOpen"
                type="time"
                defaultValue={hours.sat?.open ?? "10:00"}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Cumartesi kapanış</label>
              <input
                name="satClose"
                type="time"
                defaultValue={hours.sat?.close ?? "17:00"}
                className={inp}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 py-1 text-sm text-slate-600">
            <input
              type="checkbox"
              name="sundayClosed"
              defaultChecked
              className="h-5 w-5 accent-brand"
            />{" "}
            Pazar kapalı
          </label>
          <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
            Kaydet
          </PendingButton>
        </form>
      </section>

      {/* Fiyatlandırma */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">
          Fiyatlandırma (kategori bazlı)
        </h2>
        <div className="space-y-1.5">
          {[...main, ...addons].map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm"
            >
              <span className="text-slate-700">
                {p.label}
                {p.isAddon && (
                  <span className="ml-1 text-xs text-slate-500">(ek)</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">
                  {Number(p.price)} TL {UNIT_LABEL[p.unit]}
                </span>
                <form action={removePricingItem}>
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton
                    message={`"${p.label}" fiyat kalemi silinsin mi?`}
                    className="-my-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Sil
                  </ConfirmButton>
                </form>
              </span>
            </div>
          ))}
        </div>
        {/* Mobilde 2 kolonlu katman, sm+ ekranda 12 kolonlu tek satır */}
        <form
          action={addPricingItem}
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-12"
        >
          <input
            name="label"
            placeholder="Etiket (ör. Makine Halısı)"
            className={`${inp} col-span-2 sm:col-span-5`}
          />
          <input
            name="price"
            type="number"
            placeholder="Fiyat"
            className={`${inp} col-span-1 sm:col-span-2`}
          />
          <select name="unit" className={`${inp} col-span-1 sm:col-span-3`}>
            <option value="PER_M2">/m²</option>
            <option value="PER_PIECE">/adet</option>
            <option value="FLAT">sabit</option>
          </select>
          <label className="col-span-2 flex items-center gap-1.5 text-xs text-slate-500 sm:col-span-2">
            <input type="checkbox" name="isAddon" className="h-4 w-4 accent-brand" /> ek
          </label>
          <button className="col-span-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] sm:col-span-12">
            Fiyat ekle
          </button>
        </form>
      </section>

      {/* Hizmet bölgeleri */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Hizmet Bölgeleri</h2>
        <div className="flex flex-wrap gap-2">
          {b.serviceAreas.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700"
            >
              {s.district}
              <form action={removeServiceArea} className="inline-flex">
                <input type="hidden" name="id" value={s.id} />
                <ConfirmButton
                  message={`"${s.district}" bölgesi silinsin mi?`}
                  aria-label={`${s.district} bölgesini sil`}
                  className="-my-1.5 inline-flex h-10 w-10 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                >
                  <IconX size={14} />
                </ConfirmButton>
              </form>
            </span>
          ))}
        </div>
        {/* İl işletme profilinden gelir; ilçe resmî listeden seçilir (serbest
            metin yazım hatası şehir/ilçe eşleşmesini bozuyordu). */}
        {districtsOfCity(b.city).length > 0 ? (
          <form action={addServiceArea} className="mt-3 flex gap-2">
            <select
              name="district"
              required
              defaultValue=""
              className={`${inp} flex-1`}
            >
              <option value="" disabled>
                İlçe seç ({b.city})
              </option>
              {districtsOfCity(b.city).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
              Ekle
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            İlçe ekleyebilmek için önce Temel Bilgiler bölümünden ilini seç ve
            kaydet.
          </p>
        )}
      </section>

      {/* Fotoğraflar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">
          Fotoğraflar (logo · genel · öncesi/sonrası)
        </h2>
        {b.logoUrl && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={b.logoUrl}
              alt="İşletme logosu"
              className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-contain p-1"
            />
            <p className="text-xs text-slate-500">
              Mevcut logon — değiştirmek için aşağıdan &quot;Logo&quot; türüyle
              yeni dosya yükle.
            </p>
          </div>
        )}
        {b.photos.length > 0 ? (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {b.photos.map((p) => (
              <div
                key={p.id}
                className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.caption ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white">
                  {/* "genel" fotoğrafta iki bayrak da false — ikili ternary onu
                      yanlışlıkla "Sonrası" gösteriyordu (kullanıcı bildirdi). */}
                  {p.isBefore ? "Öncesi" : p.isAfter ? "Sonrası" : "Genel"}
                </span>
                <form action={removePhoto} className="absolute right-1 top-1">
                  <input type="hidden" name="id" value={p.id} />
                  <ConfirmButton
                    message="Fotoğraf silinsin mi?"
                    aria-label="Fotoğrafı sil"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80"
                  >
                    <IconX size={14} />
                  </ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-slate-500">Henüz fotoğraf yok.</p>
        )}
        <PhotoUpload />
      </section>
    </div>
  );
}

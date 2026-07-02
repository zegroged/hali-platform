import { getCurrentBusiness } from "@/lib/panel";
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
import { PhotoUpload } from "@/components/PhotoUpload";
import { IconX } from "@/components/icons";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand";
const lbl = "text-xs font-medium text-slate-500";

const UNIT_LABEL: Record<string, string> = {
  PER_M2: "/m²",
  PER_PIECE: "/adet",
  FLAT: "sabit",
};

export default async function PanelProfile() {
  const b = await getCurrentBusiness();
  if (!b) return null;

  const hours = (b.workingHours ?? {}) as Record<
    string,
    { open: string; close: string } | null
  >;
  const main = b.pricing.filter((p) => !p.isAddon);
  const addons = b.pricing.filter((p) => p.isAddon);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Profil &amp; Fiyat
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          İşletme bilgilerin, çalışma saatlerin, fiyatların ve hizmet
          bölgelerin.
        </p>
      </div>

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
            <div>
              <label className={lbl}>İlçe</label>
              <input name="district" defaultValue={b.district} className={inp} />
            </div>
            <div>
              <label className={lbl}>Şehir</label>
              <input name="city" defaultValue={b.city} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Adres</label>
            <input name="address" defaultValue={b.address} className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Telefon</label>
              <input name="phone" defaultValue={b.phone} className={inp} />
            </div>
            <div>
              <label className={lbl}>Vergi No</label>
              <input
                name="taxNumber"
                defaultValue={b.taxNumber ?? ""}
                className={inp}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Teslim (min gün)</label>
              <input
                name="minDays"
                type="number"
                defaultValue={b.deliveryEstimateMinDays ?? ""}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Teslim (max gün)</label>
              <input
                name="maxDays"
                type="number"
                defaultValue={b.deliveryEstimateMaxDays ?? ""}
                className={inp}
              />
            </div>
          </div>
          <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
            Kaydet
          </button>
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
          <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
            Kaydet
          </button>
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
        <form action={addServiceArea} className="mt-3 flex gap-2">
          <input
            name="district"
            placeholder="İlçe ekle"
            className={`${inp} flex-1`}
          />
          <input type="hidden" name="city" value="İstanbul" />
          <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
            Ekle
          </button>
        </form>
      </section>

      {/* Fotoğraflar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">
          Fotoğraflar (before/after)
        </h2>
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
                  {p.isBefore ? "Öncesi" : "Sonrası"}
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

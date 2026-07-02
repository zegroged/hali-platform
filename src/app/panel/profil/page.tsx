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
import { PhotoUpload } from "@/components/PhotoUpload";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
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
      {/* Temel bilgiler */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
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
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Kaydet
          </button>
        </form>
      </section>

      {/* Çalışma saatleri */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
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
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="sundayClosed" defaultChecked /> Pazar
            kapalı
          </label>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Kaydet
          </button>
        </form>
      </section>

      {/* Fiyatlandırma */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
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
                  <span className="ml-1 text-xs text-slate-400">(ek)</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">
                  {Number(p.price)} TL {UNIT_LABEL[p.unit]}
                </span>
                <form action={removePricingItem}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-xs text-red-500">sil</button>
                </form>
              </span>
            </div>
          ))}
        </div>
        <form action={addPricingItem} className="mt-3 grid grid-cols-12 gap-2">
          <input
            name="label"
            placeholder="Etiket (ör. Makine Halısı)"
            className={`${inp} col-span-5`}
          />
          <input
            name="price"
            type="number"
            placeholder="Fiyat"
            className={`${inp} col-span-2`}
          />
          <select name="unit" className={`${inp} col-span-3`}>
            <option value="PER_M2">/m²</option>
            <option value="PER_PIECE">/adet</option>
            <option value="FLAT">sabit</option>
          </select>
          <label className="col-span-2 flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" name="isAddon" /> ek
          </label>
          <button className="col-span-12 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
            Fiyat ekle
          </button>
        </form>
      </section>

      {/* Hizmet bölgeleri */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Hizmet Bölgeleri</h2>
        <div className="flex flex-wrap gap-2">
          {b.serviceAreas.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {s.district}
              <form action={removeServiceArea} className="inline">
                <input type="hidden" name="id" value={s.id} />
                <button className="text-red-500">×</button>
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
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
            Ekle
          </button>
        </form>
      </section>

      {/* Fotoğraflar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
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
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white">
                  {p.isBefore ? "Öncesi" : "Sonrası"}
                </span>
                <form action={removePhoto} className="absolute right-1 top-1">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded bg-black/60 px-1.5 text-xs text-white">
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-sm text-slate-400">Henüz fotoğraf yok.</p>
        )}
        <PhotoUpload />
      </section>
    </div>
  );
}

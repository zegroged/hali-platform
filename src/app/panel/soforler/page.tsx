import { getCurrentBusiness } from "@/lib/panel";
import { addDriver, removeDriver } from "../actions";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

export default async function PanelDrivers() {
  const b = await getCurrentBusiness();
  if (!b) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Şoförler</h1>

      <div className="space-y-2">
        {b.drivers.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-slate-900">{d.user.name}</p>
              <p className="text-sm text-slate-500">{d.user.phone}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  d.isOnShift
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {d.isOnShift ? "Mesaide" : "Mesai dışı"}
              </span>
              <form action={removeDriver}>
                <input type="hidden" name="id" value={d.id} />
                <button className="text-xs text-red-500">sil</button>
              </form>
            </div>
          </div>
        ))}
        {b.drivers.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400">
            Henüz şoför yok.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-slate-900">Şoför ekle</h2>
        <form action={addDriver} className="space-y-2">
          <input name="name" placeholder="Ad Soyad" className={inp} />
          <input name="phone" placeholder="Telefon (05xx...)" className={inp} />
          <p className="text-xs text-slate-400">
            Şoföre, telefonuna <b>SMS ile gönderilen geçici şifre</b> ile giriş bilgisi iletilir.
          </p>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Ekle
          </button>
        </form>
      </section>
    </div>
  );
}

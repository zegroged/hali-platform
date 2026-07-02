import { getCurrentBusiness } from "@/lib/panel";
import { addDriver, removeDriver } from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import EmptyState from "@/components/EmptyState";
import { IconTruck } from "@/components/icons";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand";

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
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-medium text-slate-900">{d.user.name}</p>
              <p className="text-sm text-slate-500">{d.user.phone}</p>
            </div>
            <div className="flex items-center gap-2">
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
                <ConfirmButton
                  message={`${d.user.name} silinsin mi? Bu işlem geri alınamaz.`}
                  className="rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Sil
                </ConfirmButton>
              </form>
            </div>
          </div>
        ))}
        {b.drivers.length === 0 && (
          <EmptyState
            icon={<IconTruck size={22} />}
            title="Henüz şoför yok"
            description="Aşağıdaki formdan ilk şoförünü ekle; mesaiye başladığında canlı takip ve rota geçmişi otomatik çalışır."
          />
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Şoför ekle</h2>
        <form action={addDriver} className="space-y-2">
          <input name="name" placeholder="Ad Soyad" className={inp} />
          <input name="phone" placeholder="Telefon (05xx...)" className={inp} />
          <p className="text-xs text-slate-500">
            Şoföre, telefonuna <b>SMS ile gönderilen geçici şifre</b> ile giriş bilgisi iletilir.
          </p>
          <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
            Ekle
          </button>
        </form>
      </section>
    </div>
  );
}

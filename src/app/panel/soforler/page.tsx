import { getCurrentBusiness } from "@/lib/panel";
import { addDriver, removeDriver, setDriverPassword } from "../actions";
import { ConfirmButton } from "../ConfirmButton";
import { PendingButton } from "@/components/PendingButton";
import EmptyState from "@/components/EmptyState";
import { IconTruck } from "@/components/icons";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand";
const lbl = "mb-1 block text-sm font-medium text-slate-700";

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
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
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

            {/* Şifre belirleme/sıfırlama — SMS canlı olana kadar şoförün giriş
                bilgisini halıcı bu yolla verir; sonrasında da "şifremi unuttum"
                çözümü olarak kalır. */}
            <details className="mt-3 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-dark">
                Şifre belirle
              </summary>
              <form
                action={setDriverPassword}
                className="mt-2 flex items-end gap-2"
              >
                <input type="hidden" name="id" value={d.id} />
                <div className="min-w-0 flex-1 sm:max-w-xs">
                  <label htmlFor={`sifre-${d.id}`} className={lbl}>
                    Yeni şifre
                  </label>
                  <input
                    id={`sifre-${d.id}`}
                    name="password"
                    type="password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className={inp}
                  />
                </div>
                <PendingButton className="whitespace-nowrap rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light/50 disabled:opacity-60">
                  Kaydet
                </PendingButton>
              </form>
              <p className="mt-1.5 text-xs text-slate-500">
                En az 8 karakter. Şifreyi şoförüne sen ilet; giriş adresi:
                /giris (kendi telefon numarasıyla girer).
              </p>
            </details>
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
        <form action={addDriver} className="space-y-3">
          <div>
            <label htmlFor="sofor-ad" className={lbl}>
              Ad Soyad
            </label>
            <input id="sofor-ad" name="name" required className={inp} />
          </div>
          <div>
            <label htmlFor="sofor-telefon" className={lbl}>
              Telefon
            </label>
            <input
              id="sofor-telefon"
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={11}
              placeholder="05xxxxxxxxx"
              required
              className={inp}
            />
          </div>
          <div>
            <label htmlFor="sofor-sifre" className={lbl}>
              Şifre
            </label>
            <input
              id="sofor-sifre"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className={inp}
            />
            <p className="mt-1 text-xs text-slate-500">
              En az 8 karakter. Şoförün /giris adresinden kendi telefonu ve bu
              şifreyle girer — şifreyi ona sen ilet.
            </p>
          </div>
          <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
            Ekle
          </PendingButton>
        </form>
      </section>
    </div>
  );
}

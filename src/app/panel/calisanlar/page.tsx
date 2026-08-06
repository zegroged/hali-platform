import { sadeceSahip } from "@/lib/panelYetki";
import { getCurrentBusiness } from "@/lib/panel";
import { prisma } from "@/lib/prisma";
import {
  addStaff,
  removeStaff,
  setStaffPassword,
  setStaffUsername,
} from "./actions";
import { ConfirmButton } from "../ConfirmButton";
import { PendingButton } from "@/components/PendingButton";
import EmptyState from "@/components/EmptyState";
import { IconUsers } from "@/components/icons";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand";
const lbl = "mb-1 block text-sm font-medium text-slate-700";

export default async function PanelStaff() {
  // 🔴 SAHİBE ÖZEL SAYFA (2026-08-06). Kapı PRISMA'DAN ÖNCE: App Router'da
  // layout ile page paralel render edilir, layout yönlendirse bile buradaki
  // sorgu çalışır ve veri RSC yükünde sızabilir.
  await sadeceSahip();
  const b = await getCurrentBusiness();
  if (!b) return null;

  const calisanlar = await prisma.staff.findMany({
    where: { businessId: b.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      user: { select: { name: true, phone: true, username: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Çalışanlar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dükkânda çalışan kişiye <strong>kendi hesabını</strong> aç. Böylece
          senin şifreni kullanmak zorunda kalmaz.
        </p>
      </div>

      {/* Yetki sınırı AÇIKÇA yazılıyor: işletme sahibi neyi paylaştığını
          bilmeden hesap açmasın. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-900">
          Çalışan hesabı neyi görür?
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Görür
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              <li>✓ Siparişler, yeni kayıt</li>
              <li>✓ Halı Bul, fotoğraf yükleme</li>
              <li>✓ Kesin fiyat bildirme</li>
              <li>✓ Müşteri mesajları</li>
              <li>✓ Canlı takip, rota geçmişi</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Görmez
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              <li>✕ Kasa, ciro, raporlar</li>
              <li>✕ Abonelik, ödeme, IBAN</li>
              <li>✕ Fiyat listesi, profil</li>
              <li>✕ Şoför yönetimi</li>
              <li>✕ Bu sayfa (çalışan ekleyemez)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {calisanlar.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{c.user.name}</p>
                <p className="text-sm text-slate-500">
                  Kullanıcı adı:{" "}
                  <span className="font-mono text-slate-700">
                    {c.user.username ?? "—"}
                  </span>
                </p>
                <p className="text-xs text-slate-400">{c.user.phone}</p>
              </div>
              <form action={removeStaff}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton
                  message={`${c.user.name} hesabı silinsin mi? Bir daha giriş yapamaz. Bu işlem geri alınamaz.`}
                  className="rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Sil
                </ConfirmButton>
              </form>
            </div>

            <details className="mt-3 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-dark">
                Şifre belirle / kullanıcı adını değiştir
              </summary>
              <form
                action={setStaffPassword}
                className="mt-2 flex items-end gap-2"
              >
                <input type="hidden" name="id" value={c.id} />
                <div className="min-w-0 flex-1 sm:max-w-xs">
                  <label htmlFor={`cs-${c.id}`} className={lbl}>
                    Yeni şifre
                  </label>
                  <input
                    id={`cs-${c.id}`}
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
                En az 8 karakter. Şifreyi değiştirdiğinde çalışanın telefonundaki
                oturum da anında kapanır.
              </p>

              <form
                action={setStaffUsername}
                className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3"
              >
                <input type="hidden" name="id" value={c.id} />
                <div className="min-w-0 flex-1 sm:max-w-xs">
                  <label htmlFor={`ck-${c.id}`} className={lbl}>
                    Kullanıcı adını değiştir
                  </label>
                  <input
                    id={`ck-${c.id}`}
                    name="username"
                    type="text"
                    maxLength={30}
                    defaultValue={c.user.username ?? ""}
                    required
                    autoComplete="off"
                    className={inp}
                  />
                </div>
                <PendingButton className="whitespace-nowrap rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light/50 disabled:opacity-60">
                  Kaydet
                </PendingButton>
              </form>
            </details>
          </div>
        ))}
        {calisanlar.length === 0 && (
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Henüz çalışan hesabı yok"
            description="Dükkânda sipariş kaydeden kişiye buradan hesap aç — kasanı, aboneliğini ve fiyat listeni görmeden çalışabilir."
          />
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-900">Çalışan ekle</h2>
        <form action={addStaff} className="space-y-3">
          <div>
            <label htmlFor="c-ad" className={lbl}>
              Ad Soyad
            </label>
            <input id="c-ad" name="name" required className={inp} />
          </div>
          <div>
            <label htmlFor="c-telefon" className={lbl}>
              Telefon
            </label>
            <input
              id="c-telefon"
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={11}
              placeholder="05xxxxxxxxx"
              required
              className={inp}
            />
            <p className="mt-1 text-xs text-slate-500">
              İletişim için — çalışan bununla giriş yapmaz.
            </p>
          </div>
          <div>
            <label htmlFor="c-kullanici-adi" className={lbl}>
              Kullanıcı adı (giriş için)
            </label>
            <input
              id="c-kullanici-adi"
              name="username"
              type="text"
              maxLength={30}
              placeholder="orn: ayse.dukkan"
              required
              autoComplete="off"
              className={inp}
            />
            <p className="mt-1 text-xs text-slate-500">
              Harf, rakam ve . _ - kullanılabilir.
            </p>
          </div>
          <div>
            <label htmlFor="c-sifre" className={lbl}>
              Şifre
            </label>
            <input
              id="c-sifre"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className={inp}
            />
            <p className="mt-1 text-xs text-slate-500">
              En az 8 karakter. Çalışan /giris adresinden yukarıdaki kullanıcı
              adı ve bu şifreyle girer — ikisini de ona sen ilet.
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

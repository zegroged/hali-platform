import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAccountant } from "../actions";

export const dynamic = "force-dynamic";

// Admin, mali müşavir (ACCOUNTANT) hesabı oluşturur. Bu hesap admin paneline
// giremez; yalnız /muhasebe'de fatura bilgileri + ödemeleri salt-okunur görür.
export default async function AdminAccountants({
  searchParams,
}: {
  searchParams: Promise<{ hata?: string; ok?: string }>;
}) {
  // Yetki kapısı prisma'dan ÖNCE (RSC sızıntısı önlemi).
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/giris");
  const { hata, ok } = await searchParams;

  const accountants = await prisma.user.findMany({
    where: { role: "ACCOUNTANT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, username: true, phone: true, bannedAt: true },
  });

  const inp =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
  const lbl = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link
        href="/admin"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Panele dön
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Mali Müşavir Hesapları</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mali müşavir yalnız <strong>/muhasebe</strong> sayfasını görür (fatura
          bilgileri + tahsil edilmiş ödemeler). Admin paneline giremez.
        </p>
      </div>

      {ok && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Hesap oluşturuldu: <strong>{ok}</strong>. Kullanıcı adı ve şifreyi mali
          müşavirinize iletin; <strong>/giris</strong> adresinden girer.
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

      <form
        action={createAccountant}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className={lbl}>Ad Soyad</label>
          <input name="name" required className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Telefon</label>
            <input name="phone" required placeholder="05xx..." className={inp} />
          </div>
          <div>
            <label className={lbl}>Kullanıcı adı</label>
            <input name="username" required className={inp} />
          </div>
        </div>
        <div>
          <label className={lbl}>Şifre (en az 8 karakter)</label>
          <input name="password" required minLength={8} className={inp} />
          <p className="mt-1 text-xs text-slate-500">
            Şifreyi siz belirleyip mali müşavire iletin.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Mali Müşavir Hesabı Oluştur
        </button>
      </form>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          Mevcut hesaplar ({accountants.length})
        </h2>
        {accountants.length === 0 ? (
          <p className="text-sm text-slate-400">Henüz mali müşavir hesabı yok.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {accountants.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-500">
                    @{a.username} · {a.phone}
                  </p>
                </div>
                {a.bannedAt && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    engelli
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

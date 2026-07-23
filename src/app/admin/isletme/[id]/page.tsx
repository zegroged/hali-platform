import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifMeta } from "@/lib/verifMeta";
import { subscriptionActive } from "@/lib/subscription";
import { ORDER_STATUS_META } from "@/lib/orderStatus";
import {
  activateSubscription,
  clearPauseByAdmin,
  approveBusiness,
  banUser,
  deletePhoto,
  deleteReview,
  forceOffShift,
  rejectBusiness,
  resetOwnerPassword,
  revokeBadge,
  saveAdminNote,
  suspendSubscription,
  unbanUser,
  unrejectBusiness,
} from "../../actions";
import { setBusinessAgent, setBusinessDiscount } from "../../actions";
import { PendingButton } from "@/components/PendingButton";

export const dynamic = "force-dynamic";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

const tr = (d: Date) =>
  d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const tl = (v: unknown) =>
  Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " TL";

// Tam denetim sayfası: sahip, iletişim, profil eksikleri, abonelik, şoförler,
// siparişler, fiyatlar, bölgeler, fotoğraflar — hepsi tek ekranda.
export default async function AdminBusinessDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mesaj?: string; hata?: string }>;
}) {
  // YETKİ KAPISI — prisma sorgusundan ÖNCE. Layout redirect'i tek başına yeterli
  // DEĞİL: sayfa Server Component'i layout'la paralel render olduğundan, sorgu
  // sonucu (vergi no, TC, e-posta, telefon) yetkisiz isteğin RSC akışına sızardı.
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/giris");

  const { id } = await params;
  const { mesaj, hata } = await searchParams;
  const b = await prisma.cleanerBusiness.findUnique({
    where: { id },
    include: {
      owner: true,
      subscription: true,
      referredByAgent: { include: { user: { select: { name: true } } } },
      serviceAreas: true,
      pricing: { orderBy: { createdAt: "asc" } },
      photos: { orderBy: { createdAt: "desc" } },
      drivers: { include: { user: true } },
      orders: { orderBy: { createdAt: "desc" }, take: 10 },
      reviews: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { orders: true, reviews: true } },
    },
  });
  if (!b) notFound();

  const verif = verifMeta(b.verification);
  const subOk = subscriptionActive(b.subscription);
  const checklist = [
    { label: "Vergi numarası", done: Boolean(b.taxNumber) },
    {
      label: "Teslim süresi",
      done: Boolean(b.deliveryEstimateMinDays && b.deliveryEstimateMaxDays),
    },
    { label: "Hizmet bölgesi", done: b.serviceAreas.length > 0 },
    { label: "Fiyatlandırma", done: b.pricing.some((p) => !p.isAddon) },
    { label: "Fotoğraflar", done: b.photos.length > 0 },
    { label: "Çalışma saatleri", done: Boolean(b.workingHours) },
    { label: "E-posta doğrulandı", done: b.owner.emailVerified },
    { label: "Sözleşme onayı", done: Boolean(b.contractAcceptedAt) },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="text-sm font-medium text-brand-dark hover:underline"
      >
        ← Panele dön
      </Link>

      {/* Aksiyonlardan dönen mesajlar (örn. geçici şifre) */}
      {mesaj && (
        <p
          role="status"
          className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
        >
          {mesaj}
        </p>
      )}
      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {hata}
        </p>
      )}

      {/* Başlık + durum */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {b.name}
        </h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${verif.cls}`}
        >
          {verif.label}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            b.isVisible && subOk
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {b.isVisible && subOk ? "Müşteriye görünür" : "Yayında değil"}
        </span>
        {b.pausedUntil && b.pausedUntil > new Date() && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
            Tatil modu: {tr(b.pausedUntil)} tarihine kadar sipariş almıyor
          </span>
        )}
        <span className="text-xs text-slate-400">
          Kayıt: {tr(b.createdAt)}
        </span>
      </div>

      {/* Aksiyonlar — rozet + abonelik yönetimi (yayından kaldırma/engel en
          altta, Tehlikeli Bölge'de) */}
      <div className="flex flex-wrap gap-2">
        {b.verification === "VERIFIED" ? (
          <form action={revokeBadge}>
            <input type="hidden" name="id" value={b.id} />
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Doğrulanmış rozetini geri al
            </button>
          </form>
        ) : (
          b.verification !== "REJECTED" && (
            <form action={approveBusiness}>
              <input type="hidden" name="id" value={b.id} />
              <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
                Doğrulanmış rozeti ver ✓
              </button>
            </form>
          )
        )}
        {/* Havale/EFT dönemi köprüsü — iyzico canlıya alınınca ödeme callback'i
            bunu otomatik yapacak, buton yedek kalacak. */}
        <form action={activateSubscription}>
          <input type="hidden" name="id" value={b.id} />
          <button className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand-dark hover:bg-brand-light/50">
            Ödeme alındı — 1 ay aktifleştir/uzat
          </button>
        </form>
        {b.pausedUntil && b.pausedUntil > new Date() && (
          <form action={clearPauseByAdmin}>
            <input type="hidden" name="id" value={b.id} />
            <button className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
              Tatil modunu kaldır
            </button>
          </form>
        )}
        {subOk && (
          <form action={suspendSubscription}>
            <input type="hidden" name="id" value={b.id} />
            <button className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
              Aboneliği durdur
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="İşletme Sahibi">
          {b.owner.bannedAt && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Bu hesap {tr(b.owner.bannedAt)} tarihinde engellendi — giriş
              yapamaz.
            </p>
          )}
          <Row label="Ad Soyad" value={b.owner.name} />
          <Row label="Telefon" value={b.owner.phone} />
          <Row
            label="E-posta"
            value={
              <>
                {b.owner.email ?? "—"}{" "}
                {b.owner.email && (
                  <span
                    className={
                      b.owner.emailVerified
                        ? "text-green-600"
                        : "text-amber-600"
                    }
                  >
                    {b.owner.emailVerified ? "✓ doğrulandı" : "(doğrulanmadı)"}
                  </span>
                )}
              </>
            }
          />
          <Row
            label="Sözleşme onayı"
            value={
              b.contractAcceptedAt
                ? `${tr(b.contractAcceptedAt)} · sürüm ${b.contractVersion ?? "—"}`
                : "Yok"
            }
          />
          {/* Destek yetkisi: sahibin şifresini sıfırla, geçici şifre üstte görünür */}
          <form action={resetOwnerPassword} className="mt-3">
            <input type="hidden" name="businessId" value={b.id} />
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Şifreyi sıfırla (geçici şifre üret)
            </button>
          </form>
        </Card>

        <Card title="İşletme Bilgileri">
          <Row label="Telefon" value={b.phone} />
          <Row label="İl / İlçe" value={`${b.city} / ${b.district}`} />
          <Row label="Adres" value={b.address || "—"} />
          <Row label="Vergi No" value={b.taxNumber ?? "—"} />
          <Row
            label="Teslim süresi"
            value={
              b.deliveryEstimateMinDays && b.deliveryEstimateMaxDays
                ? `${b.deliveryEstimateMinDays}-${b.deliveryEstimateMaxDays} iş günü`
                : "—"
            }
          />
          <Row
            label="Puan"
            value={
              b.ratingCount > 0
                ? `${b.ratingAvg.toFixed(1)} (${b.ratingCount} yorum)`
                : "Henüz yorum yok"
            }
          />
        </Card>

        <Card title="Profil Durumu">
          <ul className="space-y-1.5">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    c.done
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {c.done ? "✓" : "○"}
                </span>
                <span className={c.done ? "text-slate-700" : "text-slate-400"}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Komisyoncu">
          {b.referredByAgent ? (
            <p className="text-sm text-slate-700">
              <span className="font-medium">{b.referredByAgent.user.name}</span>{" "}
              · %{Number(b.referredByAgent.percent)} (KDV hariç net üzerinden,
              her yenilemede işler)
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Bağlı komisyoncu yok. Kod girerek bağlayabilirsin.
            </p>
          )}
          <form action={setBusinessAgent} className="mt-2 flex items-end gap-2">
            <input type="hidden" name="businessId" value={b.id} />
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-500">
                Tek kullanımlık komisyoncu kodu (boş gönder = bağı kaldır)
              </label>
              <input
                name="code"
                placeholder="HYK-XXXXXX"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <PendingButton className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              Kaydet
            </PendingButton>
          </form>
        </Card>

        <Card title="Abonelik İndirimi">
          {Number(b.discountPercent ?? 0) > 0 &&
          b.discountUntil &&
          b.discountUntil.getTime() > Date.now() ? (
            <p className="text-sm text-slate-700">
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                %{Number(b.discountPercent).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} indirim
              </span>{" "}
              — {tr(b.discountUntil)} tarihine kadar her tahsilat indirimli
              (%100 = dönem ücretsiz açılır).
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Aktif indirim yok. İstediğin yüzdeyi + süreyi ver; süre kaydettiğin
              andan itibaren işler (uzatmak için tekrar kaydet).
            </p>
          )}
          <form action={setBusinessDiscount} className="mt-2 flex items-end gap-2">
            <input type="hidden" name="businessId" value={b.id} />
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                İndirim % (boş = kaldır)
              </label>
              <input
                name="percent"
                inputMode="decimal"
                placeholder="Örn. 50"
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Süre (ay)</label>
              <input
                name="months"
                inputMode="numeric"
                placeholder="Örn. 6"
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <PendingButton className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              Kaydet
            </PendingButton>
          </form>
        </Card>

        <Card title="Abonelik">
          <Row
            label="Durum"
            value={
              subOk ? (
                <span className="text-green-600">Aktif</span>
              ) : (
                <span className="text-slate-500">Yok / süresi dolmuş</span>
              )
            }
          />
          {b.subscription?.currentPeriodEnd && (
            <>
              <Row
                label="Dönem sonu"
                value={tr(b.subscription.currentPeriodEnd)}
              />
              <Row
                label="Kalan gün"
                value={Math.max(
                  0,
                  Math.ceil(
                    (b.subscription.currentPeriodEnd.getTime() - Date.now()) /
                      (24 * 60 * 60 * 1000),
                  ),
                )}
              />
            </>
          )}
          <Row label="Aylık bedel" value="2.000 TL + KDV" />
        </Card>

        <Card title={`Şoförler (${b.drivers.length})`}>
          {b.drivers.length === 0 ? (
            <p className="text-sm text-slate-500">Kayıtlı şoför yok.</p>
          ) : (
            <ul className="space-y-2">
              {b.drivers.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 font-medium text-slate-900">
                    {d.user.name}
                    <span className="ml-2 font-normal text-slate-500">
                      {d.user.phone}
                    </span>
                    {d.user.bannedAt && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Engelli
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span
                      className={
                        d.isOnShift ? "text-green-600" : "text-slate-400"
                      }
                    >
                      {d.isOnShift ? "Mesaide" : "Mesai dışı"}
                    </span>
                    {d.isOnShift && (
                      <form action={forceOffShift}>
                        <input type="hidden" name="driverId" value={d.id} />
                        <input type="hidden" name="businessId" value={b.id} />
                        <button className="rounded border border-amber-400 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
                          Mesaiden düşür
                        </button>
                      </form>
                    )}
                    <form action={d.user.bannedAt ? unbanUser : banUser}>
                      <input type="hidden" name="userId" value={d.user.id} />
                      <input type="hidden" name="businessId" value={b.id} />
                      <button
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${
                          d.user.bannedAt
                            ? "border-slate-300 text-slate-600 hover:bg-slate-50"
                            : "border-red-300 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        {d.user.bannedAt ? "Engeli kaldır" : "Engelle"}
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Hizmet Bölgeleri">
          {b.serviceAreas.length === 0 ? (
            <p className="text-sm text-slate-500">Bölge eklenmemiş.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {b.serviceAreas.map((a) => (
                <span
                  key={a.id}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {a.district}, {a.city}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card title="Fiyatlar">
          {b.pricing.length === 0 ? (
            <p className="text-sm text-slate-500">Fiyat girilmemiş.</p>
          ) : (
            <ul className="space-y-1">
              {b.pricing.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 text-sm">
                  <span className="text-slate-700">
                    {p.label}
                    {p.isAddon && (
                      <span className="ml-1 text-xs text-slate-400">
                        (ek hizmet)
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap font-medium text-slate-900">
                    {tl(p.price)}
                    {p.unit === "PER_M2" ? "/m²" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Son Siparişler (toplam ${b._count.orders})`}>
          {b.orders.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz sipariş yok.</p>
          ) : (
            <ul className="space-y-2">
              {b.orders.map((o) => (
                <li key={o.id} className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-slate-500">
                      {o.code ?? o.id.slice(-6)}
                    </span>{" "}
                    <span className="text-slate-700">{o.customerName}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-slate-500">
                      {ORDER_STATUS_META[o.status]?.label ?? o.status}
                    </span>
                    {o.priceTotal != null && (
                      <span className="ml-2 font-medium text-slate-900">
                        {tl(o.priceTotal)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Yorum moderasyonu */}
      {b.reviews.length > 0 && (
        <Card title={`Son Yorumlar (toplam ${b._count.reviews})`}>
          <ul className="space-y-3">
            {b.reviews.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium text-slate-900">
                    {r.rating}/5
                  </span>{" "}
                  <span className="text-slate-600">
                    {r.comment ?? "(yorum metni yok)"}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {tr(r.createdAt)}
                  </span>
                </span>
                <form action={deleteReview} className="shrink-0">
                  <input type="hidden" name="reviewId" value={r.id} />
                  <input type="hidden" name="businessId" value={b.id} />
                  <button className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    Sil
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">
            Silinen yorum geri gelmez; puan ortalaması otomatik güncellenir.
          </p>
        </Card>
      )}

      {/* Fotoğraf moderasyonu */}
      {b.photos.length > 0 && (
        <Card title={`Fotoğraflar (${b.photos.length})`}>
          <div className="flex flex-wrap gap-3">
            {b.photos.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.caption ?? b.name}
                  className="h-24 w-32 rounded-lg border border-slate-200 object-cover"
                  loading="lazy"
                />
                <form action={deletePhoto}>
                  <input type="hidden" name="photoId" value={p.id} />
                  <input type="hidden" name="businessId" value={b.id} />
                  <button className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    Sil
                  </button>
                </form>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Uygunsuz fotoğrafı sil — fotoğraf şartı bozulursa ilan otomatik
            yayından düşer.
          </p>
        </Card>
      )}

      {/* Admin içi not — işletme GÖRMEZ (denetim gerekçeleri, görüşmeler) */}
      <Card title="Admin Notu (işletme görmez)">
        <form action={saveAdminNote} className="space-y-2">
          <input type="hidden" name="id" value={b.id} />
          <textarea
            name="note"
            defaultValue={b.adminNote ?? ""}
            rows={3}
            maxLength={2000}
            placeholder="Denetim gerekçesi, telefon görüşmesi, ödeme kaydı…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
          />
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Notu kaydet
          </button>
        </form>
      </Card>

      {/* Tehlikeli Bölge — kısıtlama/engelleme yetkileri (sözleşme §4 askıya
          alma usulüne uygun: gerekçeyi işletmeye ayrıca bildir) */}
      <section className="rounded-xl border border-red-200 bg-red-50/50 p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-700">
          Tehlikeli Bölge
        </h2>
        <p className="mb-3 text-sm text-red-700/80">
          Bu işlemler işletmeyi yayından düşürür veya hesap girişini kilitler.
          Sözleşme gereği gerekçeyi işletmeye bildirmeyi unutma.
        </p>
        <div className="flex flex-wrap gap-2">
          {b.verification === "REJECTED" ? (
            <form action={unrejectBusiness}>
              <input type="hidden" name="id" value={b.id} />
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Yayına geri al
              </button>
            </form>
          ) : (
            <form action={rejectBusiness}>
              <input type="hidden" name="id" value={b.id} />
              <button className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                İlanı yayından kaldır
              </button>
            </form>
          )}
          {b.owner.bannedAt ? (
            <form action={unbanUser}>
              <input type="hidden" name="userId" value={b.owner.id} />
              <input type="hidden" name="businessId" value={b.id} />
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Sahibin engelini kaldır
              </button>
            </form>
          ) : (
            <form action={banUser}>
              <input type="hidden" name="userId" value={b.owner.id} />
              <input type="hidden" name="businessId" value={b.id} />
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Hesabı engelle (sahip)
              </button>
            </form>
          )}
        </div>
        <p className="mt-2 text-xs text-red-700/70">
          Engel: giriş + açık oturumlar + şoför uygulaması anında kilitlenir;
          işletme sahibi engellenirse ilan da yayından düşer. Geri alınabilir.
        </p>
      </section>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBusiness,
  completenessChecklist,
  verificationReady,
} from "@/lib/panel";
import { subscriptionActive } from "@/lib/subscription";
import { effectiveSubscriptionGross } from "@/lib/discount";
import { paymentsLive } from "@/lib/config";
import { submitForVerification, setPauseMode } from "./actions";
import { startSubscriptionPayment } from "./subscription-actions";
import { acceptContractVersioned } from "./contract-actions";
import { CONTRACT_VERSION } from "@/lib/legal";
import { PendingButton } from "@/components/PendingButton";
import { EmailVerify } from "@/components/EmailVerify";
import PanelAnaEkran from "@/components/PanelAnaEkran";
import {
  IconCheck,
  IconChevronRight,
  IconWallet,
  IconPackage,
} from "@/components/icons";

function fmtTarih(dt: Date) {
  return new Date(dt).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

// Sözleşme onay tarihi yıl ile gösterilir (hangi yılın sürümü olduğu önemli).
function fmtGun(dt: Date) {
  return new Date(dt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  });
}

export default async function PanelHome({
  searchParams,
}: {
  searchParams: Promise<{ odeme?: string; hata?: string; kaydedildi?: string }>;
}) {
  const b = await getCurrentBusiness();
  if (!b) return null;
  const { odeme, hata, kaydedildi } = await searchParams;

  const [pendingOrders, activeOrders, delivered] = await Promise.all([
    prisma.order.count({ where: { businessId: b.id, status: "CREATED" } }),
    prisma.order.count({
      where: {
        businessId: b.id,
        status: { in: ["ACCEPTED", "PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"] },
      },
    }),
    // Son teslimatlar: tahsilat + adres + teslim kanıtı fotoğrafı bir arada.
    prisma.order.findMany({
      where: { businessId: b.id, status: "DELIVERED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        customerName: true,
        pickupAddress: true,
        priceTotal: true,
        deliveryPhotoUrl: true,
        pickupPhotoUrl: true,
        updatedAt: true,
      },
    }),
  ]);
  const onShift = b.drivers.filter((d) => d.isOnShift).length;
  const ready = verificationReady(b);

  // Otomatik yayın koşulları — her eksik, panelde ilgili sayfaya link verir.
  const checklist: { label: string; done: boolean; href: string }[] = [
    ...completenessChecklist(b).map((c) => ({ ...c, href: "/panel/profil" })),
    {
      label: "En az bir şoför",
      done: b.drivers.length > 0,
      href: "/panel/soforler",
    },
  ];
  const subOk = subscriptionActive(b.subscription);
  // İndirim (premium komisyoncu kodu / yönetim): buton indirimli tutarı
  // gösterir; indirimliyken erken yenileme kapalı (abonelik sayfasıyla aynı kural).
  const { gross: indirimGross, pct: indirimPct } = effectiveSubscriptionGross(b);
  const indirimliErkenYasak =
    indirimPct != null &&
    (b.subscription?.currentPeriodEnd?.getTime() ?? 0) >
      Date.now() + 3 * 24 * 60 * 60 * 1000;
  // Tatil modu durumu + tarih girişinin sınırları (TR takvim günü: bugün..+90).
  const isPaused = b.pausedUntil != null && b.pausedUntil > new Date();
  const TR_MS = 3 * 60 * 60 * 1000; // kalıcı UTC+3
  const pauseMin = new Date(Date.now() + TR_MS).toISOString().slice(0, 10);
  const pauseMax = new Date(Date.now() + TR_MS + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const missingCount =
    checklist.filter((c) => !c.done).length +
    (b.owner.emailVerified ? 0 : 1) +
    (b.contractAcceptedAt ? 0 : 1);

  // Sözleşme "güncel onaylı" sayılır: onay VAR ve onaylanan sürüm yürürlükteki
  // sürümle aynı. Sürüm farklı/boşsa yeniden onay istenir (ETAHS Yön. md.16 +
  // Geçici md.1/2: güncellenmeyen sözleşmenin ilgili hükümleri geçersizdir).
  const contractCurrent =
    b.contractAcceptedAt != null && b.contractVersion === CONTRACT_VERSION;

  // İstatistik kartları: üçü de tıklanabilir, hover + chevron ile bunu belli eder.
  const statCard =
    "relative block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand hover:shadow-sm";

  const odemeBanner: Record<string, { cls: string; text: string }> = {
    basarili: {
      cls: "border-green-300 bg-green-50 text-green-800",
      text: "Ödemen alındı — aboneliğin aktif. Profilin tamsa hesabın yayında!",
    },
    hata: {
      cls: "border-red-300 bg-red-50 text-red-700",
      text: "Ödeme tamamlanamadı. Tekrar deneyebilir veya bize ulaşabilirsin.",
    },
    eposta: {
      cls: "border-amber-300 bg-amber-50 text-amber-800",
      text: "Ödemeden önce e-posta adresini doğrulaman gerekiyor (aşağıdan).",
    },
    vergino: {
      cls: "border-amber-300 bg-amber-50 text-amber-800",
      text: "Ödemeden önce profilinde vergi/kimlik numaranı girmen gerekiyor.",
    },
  };
  const banner = odeme ? odemeBanner[odeme] : undefined;

  return (
    <div className="space-y-6">
      {/* Aksiyonlardan (örn. tatil modu) dönen hata/başarı mesajları */}
      {hata && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {hata}
        </p>
      )}
      {kaydedildi && (
        <p className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {kaydedildi}.
        </p>
      )}
      {banner && (
        <p className={`rounded-xl border px-4 py-3 text-sm ${banner.cls}`}>
          {banner.text}
        </p>
      )}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Hoş geldin, {b.name}{" "}
          <Link
            href="/sifre"
            className="align-middle text-sm font-medium text-slate-500 underline hover:text-slate-700"
          >
            🔑 Şifremi değiştir
          </Link>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Yayın durumu — tek bakışta: yayında / ödeme bekliyor / eksik var */}
          {b.verification === "REJECTED" ? (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              Hesap yayından kaldırıldı — bizimle iletişime geçin
            </span>
          ) : b.isVisible && subOk ? (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Yayındasın — müşterilere görünüyorsun ✓
            </span>
          ) : b.isVisible ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              Ödeme bekleniyor — abonelik ödemen alınınca yayına girersin
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              Yayında değil — {missingCount} eksik var, aşağıyı doldur
            </span>
          )}
          {b.verification === "VERIFIED" && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Doğrulanmış ✓
            </span>
          )}
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/panel/siparisler" className={statCard}>
          <IconChevronRight
            size={16}
            className="absolute right-2.5 top-2.5 text-slate-400"
          />
          <div className="text-2xl font-bold text-brand-dark">
            {pendingOrders}
          </div>
          <div className="text-xs text-slate-500">Yeni talep</div>
        </Link>
        <Link href="/panel/siparisler" className={statCard}>
          <IconChevronRight
            size={16}
            className="absolute right-2.5 top-2.5 text-slate-400"
          />
          <div className="text-2xl font-bold text-slate-900">{activeOrders}</div>
          <div className="text-xs text-slate-500">Süren iş</div>
        </Link>
        <Link href="/panel/soforler" className={statCard}>
          <IconChevronRight
            size={16}
            className="absolute right-2.5 top-2.5 text-slate-400"
          />
          <div className="text-2xl font-bold text-slate-900">
            {onShift}/{b.drivers.length}
          </div>
          <div className="text-xs text-slate-500">Mesaide şoför</div>
        </Link>
      </div>

      {/* MOBİL ana-ekran ızgarası: panelin 7 sayfası "Daha fazla" menüsünde
          gizliydi ve kullanıcı onları hiç açmıyordu (bkz. PanelAnaEkran). */}
      <PanelAnaEkran />

      {/* Son teslimatlar — tutar + adres + teslim fotoğrafı (şoför çeker) */}
      {delivered.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Son teslimatlar</h2>
            <Link
              href="/panel/siparisler"
              className="text-sm text-brand-dark hover:underline"
            >
              Tümü
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {delivered.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/panel/siparisler/${o.id}`}
                  className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition hover:bg-slate-50"
                >
                  {o.deliveryPhotoUrl || o.pickupPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(o.deliveryPhotoUrl ?? o.pickupPhotoUrl)!}
                      alt="Teslim fotoğrafı"
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <IconPackage size={18} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {o.customerName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {o.pickupAddress}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-brand-dark">
                      {o.priceTotal != null ? `${Number(o.priceTotal)} TL` : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtTarih(o.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sözleşme sürümü uyarısı (doğrulanmış işletmeler): aşağıdaki profil
          kartı yalnız doğrulanmamışlara görünür — sözleşme güncellenince
          MEVCUT işletmelerden yeniden onay buradan alınır (Geçici md.1/2). */}
      {b.verification === "VERIFIED" && !contractCurrent && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            Platform sözleşmesi güncellendi
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {b.contractAcceptedAt
              ? `Onayınız eski bir sürüme ait (Onaylanan sürüm: ${
                  b.contractVersion ?? "kayıtlı değil"
                } · Tarih: ${fmtGun(b.contractAcceptedAt)}). Aracılık hizmetinin kesintisiz sürmesi için güncel sürümü onaylayın.`
              : "Platform sözleşmesi henüz onaylanmadı. Devam etmek için güncel sürümü onaylayın."}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <form action={acceptContractVersioned}>
              <PendingButton className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
                Güncel sözleşmeyi onayla
              </PendingButton>
            </form>
            <Link
              href="/isletme-sozlesmesi"
              target="_blank"
              className="text-sm font-medium text-amber-900 underline"
            >
              Sözleşme metnini oku
            </Link>
          </div>
        </div>
      )}

      {/* Abonelik */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Abonelik</p>
            <p className="text-sm text-slate-500">
              {subOk ? "Aktif" : "Yok"} · 2.000 TL + KDV/ay
            </p>
            {subOk && b.subscription?.currentPeriodEnd && (
              <p className="mt-1 text-xs text-slate-500">
                Dönem sonu: {fmtGun(b.subscription.currentPeriodEnd)}
              </p>
            )}
          </div>
          <IconWallet size={26} className="text-brand-dark" />
        </div>
        {/* iyzico kartlı ödeme yalnız PAYMENTS_MODE=live iken; ödeme başarılı
            olunca hesap OTOMATİK yayına girer (callback). Kart bilgisi iyzico'nun
            güvenli sayfasında. Canlı değilken havale/EFT + admin aktivasyonu. */}
        {paymentsLive ? (
          indirimliErkenYasak ? (
            <p className="mt-2 text-xs text-amber-700">
              İndirimli dönemin aktif — yenileme, dönem sonuna 3 gün kala
              /panel/abonelik&apos;ten açılır.
            </p>
          ) : (
          <>
            <form action={startSubscriptionPayment} className="mt-3">
              <PendingButton className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
                {indirimGross <= 0
                  ? "Dönemini ücretsiz başlat (%100 indirim)"
                  : indirimPct != null
                    ? `Aboneliğini öde — ${indirimGross.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL (indirimli, iyzico ile)`
                    : subOk
                      ? "Aboneliği yenile — 2.400 TL (iyzico ile güvenli ödeme)"
                      : "Aboneliğini öde — 2.400 TL (iyzico ile güvenli ödeme)"}
              </PendingButton>
            </form>
            <p className="mt-1.5 text-xs text-slate-400">
              Ödeme, iyzico&apos;nun güvenli sayfasında yapılır; kart bilgilerin
              bize hiç ulaşmaz.{" "}
              {indirimPct != null
                ? `İndirimli tutar KDV dahildir (normal bedel 2.400 TL).`
                : "2.000 TL + %20 KDV = 2.400 TL."}
            </p>
          </>
          )
        ) : (
          !subOk && (
            <p className="mt-2 text-xs text-amber-700">
              Ödemen alındığında hesabın yayına girer — ödeme bilgileri e-posta
              adresine gönderilir.
            </p>
          )
        )}
        <Link
          href="/panel/abonelik"
          className="mt-3 inline-block text-sm font-medium text-brand-dark hover:underline"
        >
          Aboneliği yönet (geçmiş, iptal) →
        </Link>
      </div>

      {/* Tatil modu — yeni kamu siparişini geçici kapat; profil yayında kalır,
          panelden manuel kayıt etkilenmez. */}
      <div
        className={`rounded-xl border p-4 ${
          isPaused ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
        }`}
      >
        <p className="font-medium text-slate-900">Tatil modu</p>
        {isPaused ? (
          <>
            <p className="mt-1 text-sm text-amber-800">
              Siparişler <strong>{fmtGun(b.pausedUntil!)}</strong> tarihine
              kadar duraklatıldı — profilin yayında ama müşteriler yeni sipariş
              veremiyor. Panelden manuel sipariş açmaya devam edebilirsin.
            </p>
            <form action={setPauseMode} className="mt-3">
              <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
                Duraklatmayı kaldır — siparişleri aç
              </PendingButton>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Bayram, tadilat gibi dönemlerde yeni siparişleri geçici kapat.
              Profilin yayında ve aramalarda kalır; seçtiğin günün sonunda
              siparişler otomatik açılır.
            </p>
            {/* 2026-07-30: tarih alanı ETİKETSİZDİ. Android Chrome boş bir
                `type="date"` alanını yazısız gri kutu + ok olarak çiziyor;
                telefondan bakan halıcı orada ne istendiğini anlamıyordu
                (kullanıcının ekran görüntüsüyle tespit edildi). Etiket eklendi
                ve alan telefonda tam genişliğe alındı. */}
            <form action={setPauseMode} className="mt-3 space-y-2">
              <label className="block">
                <span className="block text-sm font-medium text-slate-700">
                  Hangi tarihe kadar kapalı kalsın?
                </span>
                <input
                  type="date"
                  name="pausedUntil"
                  required
                  min={pauseMin}
                  max={pauseMax}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand sm:w-auto"
                />
              </label>
              <PendingButton className="w-full rounded-lg border border-amber-400 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 active:scale-[0.99] disabled:opacity-60 sm:w-auto">
                Bu tarihe kadar duraklat
              </PendingButton>
            </form>
          </>
        )}
      </div>

      {/* Yayın koşulları — eksik varsa "burayı doldur" listesi. Tümü dolunca
          hesap OTOMATİK yayına alınır (onay beklemez); yayında kalmak için
          abonelik ödemesi gerekir. */}
      {(missingCount > 0 || b.verification !== "VERIFIED") && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-medium text-slate-900">
            {missingCount > 0 ? "Yayına girmek için doldur" : "Doğrulanmış İşletme rozeti"}
          </p>
          {missingCount > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              Aşağıdakilerin tümü tamamlanınca hesabın{" "}
              <strong>otomatik yayına alınır</strong> — onay beklemezsin.
              Eksik maddeye tıkla, ilgili sayfaya git.
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full ${
                    c.done
                      ? "bg-green-100 text-green-600"
                      : "border border-amber-400"
                  }`}
                >
                  {c.done && <IconCheck size={11} />}
                </span>
                {c.done ? (
                  <span className="text-slate-700">{c.label}</span>
                ) : (
                  <Link
                    href={c.href}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    {c.label} — burayı doldur →
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* E-posta doğrulama */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                E-posta doğrulama
              </span>
              {b.owner.emailVerified && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                  <IconCheck size={15} /> Doğrulandı
                </span>
              )}
            </div>
            {!b.owner.emailVerified && (
              <div className="mt-2">
                <EmailVerify initialEmail={b.owner.email} />
              </div>
            )}
          </div>

          {/* Sözleşme onayı — sürümlü kayıt: onay tarihi + onaylanan sürüm
              (ETAHS Yön. md.11/2-c ispatı; eski/boş sürümde yeniden onay). */}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-sm font-medium text-slate-700">
                  Platform sözleşmesi
                </span>
                <Link
                  href="/isletme-sozlesmesi"
                  target="_blank"
                  className="text-sm text-brand-dark hover:underline"
                >
                  Sözleşme metnini oku
                </Link>
                {b.contractAcceptedAt && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Onaylanan sürüm: {b.contractVersion ?? "kayıtlı değil"} ·
                    Tarih: {fmtGun(b.contractAcceptedAt)}
                  </p>
                )}
              </div>
              {contractCurrent && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                  <IconCheck size={15} /> Onaylandı
                </span>
              )}
            </div>
            {!contractCurrent && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  {b.contractAcceptedAt
                    ? "Sözleşme güncellendi: onayınız eski bir sürüme ait. Aracılık hizmetinin kesintisiz sürmesi için güncel sürümü onaylayın."
                    : "Platform sözleşmesi henüz onaylanmadı."}
                </p>
                <form action={acceptContractVersioned} className="mt-2">
                  <PendingButton className="rounded-lg border border-brand bg-white px-3 py-2 text-sm font-medium text-brand-dark transition hover:bg-brand-light">
                    Güncel sözleşmeyi onayla
                  </PendingButton>
                </form>
              </div>
            )}
          </div>

          {/* 2026-07-30: `flex` + uzun yan metin, "Profili düzenle" butonunu
              360px'te iki satıra kırıyordu. Telefonda alt alta, sm'den itibaren
              yan yana. */}
          <div className="mt-4 flex flex-col items-start gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center">
            <Link
              href="/panel/profil"
              className="whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Profili düzenle
            </Link>
            {/* Rozet başvurusu — yayın için ZORUNLU DEĞİL; vergi kaydının
                incelendiğini gösteren güven işareti. */}
            {b.verification === "VERIFIED" ? null : ready &&
              b.verification !== "PENDING" ? (
              <form action={submitForVerification}>
                <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]">
                  Doğrulanmış rozeti için başvur
                </button>
              </form>
            ) : b.verification === "PENDING" ? (
              <span className="text-xs text-slate-500">
                Rozet başvurun incelemede — yayına girmek için beklemene gerek
                yok.
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Eksikleri tamamlayınca &quot;Doğrulanmış&quot; rozetine
                başvurabilirsin (yayın için zorunlu değil).
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

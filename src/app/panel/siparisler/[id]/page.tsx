import Link from "next/link";
import MoneyInput from "@/components/MoneyInput";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/config";
import {
  ORDER_STATUS_META,
  CUSTOMER_FLOW,
  PANEL_NEXT,
  REJECT_REASONS,
} from "@/lib/orderStatus";
import {
  OrderStatusIcon,
  IconCheck,
  IconPhone,
  IconMapPin,
} from "@/components/icons";
import { OrderPhotoManager } from "@/components/OrderPhotoManager";
import { PendingButton } from "@/components/PendingButton";
import { ConfirmButton } from "../../ConfirmButton";
import {
  acceptOrderPanel,
  advanceOrderPanel,
  deliverOrderPanel,
  setOrderEta,
  quoteOrderPrice,
  notifyOrderReady,
  rejectOrder,
  cancelOrder,
  reassignOrder,
} from "../../actions";

const STATUS_CLS: Record<string, string> = {
  CREATED: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-blue-100 text-blue-700",
  REJECTED: "bg-red-100 text-red-700",
  PICKED_UP: "bg-indigo-100 text-indigo-700",
  WASHING: "bg-cyan-100 text-cyan-700",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELED: "bg-slate-200 text-slate-600",
};

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

function fmt(dt: Date) {
  return new Date(dt).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

export default async function OrderManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // HAFİF sorgu: bu sayfa yalnız işletme id'si + şoför listesi kullanıyor.
  // getCurrentBusiness tüm işletme grafiğini (fiyat/bölge/foto...) çekiyordu ve
  // her form işleminden sonraki yeniden-render'ı yavaşlatıyordu (B: hız).
  const u = await getSessionUser();
  if (!u || u.role !== "CLEANER") redirect("/giris");
  const b = await prisma.cleanerBusiness.findUnique({
    where: { ownerId: u.id },
    select: {
      id: true,
      name: true, // WhatsApp mesajında işletme adı geçsin
      drivers: {
        select: { id: true, user: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!b) return null;

  const { id } = await params;
  const o = await prisma.order.findFirst({
    where: { id, businessId: b.id },
    include: {
      driver: { include: { user: { select: { name: true } } } },
      photos: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!o) notFound();

  const meta = ORDER_STATUS_META[o.status];
  const closed = ["DELIVERED", "CANCELED", "REJECTED"].includes(o.status);
  const cancelable = ["CREATED", "ACCEPTED", "PICKED_UP", "WASHING"].includes(
    o.status,
  );
  const step = PANEL_NEXT[o.status];
  const flowIdx = CUSTOMER_FLOW.indexOf(o.status);
  // Güvenlik (denetim bulgusu): işletmeye ASLA uzun trackingToken gösterme —
  // onunla kesin-fiyat onayı/iptal yapılabiliyor. Yalnız kısa kod (her siparişte
  // createOrderWithCode ile üretilir). "Müşteri görünümü" linki kod ile açılınca
  // read-only olur (onay/iptal butonları görünmez).
  const trackRef = o.code ?? "";
  const trackUrl = `${getAppBaseUrl()}/takip/${trackRef}`;

  // Müşterinin WhatsApp bağlantısı: TR numarası 90… biçimine çevrilir; mesaj
  // işletme adı + takip kodu + link içerir (halıcı sadece "Gönder"e basar).
  const waDigits = (() => {
    const d = (o.customerPhone || "").replace(/\D/g, "");
    if (d.startsWith("90") && d.length === 12) return d;
    if (d.startsWith("0") && d.length === 11) return "90" + d.slice(1);
    if (d.length === 10) return "90" + d;
    return null;
  })();
  const waLink =
    waDigits && trackRef
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
          `Merhaba ${o.customerName}, ${b.name} olarak siparişinizi kaydettik. Takip kodunuz: ${trackRef}\nHalınızın durumunu buradan izleyebilirsiniz: ${trackUrl}`,
        )}`
      : null;

  return (
    <div className="space-y-4">
      <Link
        href="/panel/siparisler"
        className="block text-sm text-brand-dark hover:underline"
      >
        ← Siparişler
      </Link>

      {/* Başlık: müşteri + durum */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {o.customerName}
            </h1>
            <a
              href={`tel:${o.customerPhone}`}
              className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-brand-dark"
            >
              <IconPhone size={14} /> {o.customerPhone}
            </a>
            {/* TEK TIK WHATSAPP (2026-07-26): halıcı KENDİ numarasından, hazır
                yazılmış mesajla takip kodunu gönderir. Meta API'siz, ücretsiz;
                otomatik gönderim (Cloud API) sonra bunun üstüne eklenecek. */}
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
              >
                WhatsApp&apos;tan takip kodunu gönder
              </a>
            )}
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
              <IconMapPin size={14} className="mt-0.5 shrink-0" />
              {o.pickupAddress}
            </p>
            {o.approxM2 && (
              <p className="mt-1 text-sm text-slate-500">~{o.approxM2} m²</p>
            )}
            {o.note && (
              <p className="mt-1 text-sm italic text-slate-500">
                Not: {o.note}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLS[o.status]}`}
          >
            <OrderStatusIcon status={o.status} size={12} /> {meta.label}
          </span>
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
          Takip kodu:{" "}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            {trackRef}
          </span>{" "}
          ·{" "}
          <a
            href={trackUrl}
            target="_blank"
            className="text-brand-dark underline"
          >
            Müşteri görünümü
          </a>
        </p>
        {o.priceTotal != null && (
          <p className="mt-1 text-sm font-medium text-slate-900">
            Tahsilat: {Number(o.priceTotal)} TL
          </p>
        )}
      </div>

      {/* Durum yönetimi */}
      <div className={card}>
        <h2 className="font-semibold text-slate-900">Durum</h2>
        {o.status === "REJECTED" && o.rejectReason && (
          <p className="mt-2 text-sm text-red-600">
            Red sebebi: {o.rejectReason}
          </p>
        )}

        <ol className="mt-3 space-y-2">
          {CUSTOMER_FLOW.map((s, i) => {
            const done = flowIdx >= 0 && i < flowIdx;
            const current = s === o.status;
            return (
              <li key={s} className="flex items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-brand text-white"
                      : current
                        ? "bg-brand text-white ring-4 ring-brand/20"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? (
                    <IconCheck size={14} />
                  ) : (
                    <OrderStatusIcon status={s} size={14} />
                  )}
                </span>
                <span
                  className={`text-sm ${
                    current
                      ? "font-semibold text-slate-900"
                      : done
                        ? "text-slate-600"
                        : "text-slate-500"
                  }`}
                >
                  {ORDER_STATUS_META[s].label}
                  {current && !closed && (
                    <span className="ml-2 rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark">
                      Şu anda
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Sıradaki adım — duruma göre tek net aksiyon */}
        {o.status === "CREATED" && (
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
            <form action={acceptOrderPanel} className="sm:mr-2">
              <input type="hidden" name="orderId" value={o.id} />
              <PendingButton className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60 sm:w-auto">
                Siparişi Onayla
              </PendingButton>
            </form>
            <form action={rejectOrder} className="flex items-end gap-1.5">
              <input type="hidden" name="orderId" value={o.id} />
              <div className="min-w-0 flex-1 sm:flex-none">
                <span className="block text-xs font-medium text-slate-500">
                  Ret sebebi
                </span>
                <select
                  name="reason"
                  defaultValue=""
                  required
                  aria-label="Ret sebebi"
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm sm:w-auto"
                >
                  <option value="" disabled>
                    Seç…
                  </option>
                  {REJECT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <PendingButton className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
                Reddet
              </PendingButton>
            </form>
          </div>
        )}

        {step && (
          <form
            action={advanceOrderPanel}
            className="mt-4 border-t border-slate-100 pt-4"
          >
            <input type="hidden" name="orderId" value={o.id} />
            {/* md.15/1-h: dijital fiyat onayı yoksa yıkamaya geçiş, işletmenin
                sözlü onay BEYANINA bağlı — beyan zaman damgalı kayda geçer. */}
            {o.status === "PICKED_UP" && !o.priceApprovedAt && (
              <label className="mb-3 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="verbalConsent"
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-brand"
                />
                <span>
                  Müşterinin kesin fiyata sözlü onayını aldım; bu beyan kayda
                  geçer.
                </span>
              </label>
            )}
            <PendingButton className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60 sm:w-auto">
              {step.action} →
            </PendingButton>
            {step.next === "OUT_FOR_DELIVERY" && (
              <p className="mt-2 text-xs text-slate-500">
                Müşteriye canlı takip bağlantısı gönderilir.
              </p>
            )}
          </form>
        )}

        {o.status === "OUT_FOR_DELIVERY" && (
          <form
            action={deliverOrderPanel}
            className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4"
          >
            <input type="hidden" name="orderId" value={o.id} />
            <div>
              <label
                htmlFor="teslim-tutar"
                className="block text-xs font-medium text-slate-500"
              >
                Tahsil edilen tutar (TL)
              </label>
              {/* Anlaşılan/bildirilen tutar varsa HAZIR gelir (2026-07-26):
                  halıcı manuel kayıtta ya da kesin fiyatta yazdıysa teslimde
                  tekrar yazmasın — tek tıkla teslim etsin. */}
              <div className="mt-0.5 w-40">
                <MoneyInput
                  id="teslim-tutar"
                  name="price"
                  required
                  defaultValue={
                    o.quotedPrice != null ? String(o.quotedPrice) : ""
                  }
                  placeholder="Ör. 850"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
                />
              </div>
            </div>
            {/* TAHSİLAT BEYANI (2026-07-29). Eskiden nakit teslim SESSİZCE
                "ödendi" sayılıyordu. Kutu nakitte İŞARETLİ geliyor — olağan
                akışta halıcı için hiçbir şey değişmiyor — ama işareti
                kaldırınca sipariş "teslim edildi, tahsil edilmedi" durumunda
                kalıyor. Kurumsal müşteri (ay sonu fatura) ve gün sonu
                mutabakatı bu duruma dayanıyor. */}
            {o.paymentMethod === "CASH" && (
              <div>
                <label
                  htmlFor="teslim-tahsilat"
                  className="block text-xs font-medium text-slate-500"
                >
                  Ücreti aldın mı?
                </label>
                <select
                  id="teslim-tahsilat"
                  name="collected"
                  defaultValue="CASH"
                  className="mt-0.5 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
                >
                  <option value="CASH">Nakit aldım</option>
                  <option value="IBAN">IBAN&apos;a geldi</option>
                  <option value="NO">Almadım (sonra ödeyecek)</option>
                </select>
              </div>
            )}
            <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
              Teslim Edildi
            </PendingButton>
          </form>
        )}

        {cancelable && (
          <form action={cancelOrder} className="mt-3">
            <input type="hidden" name="orderId" value={o.id} />
            <ConfirmButton
              message="Sipariş iptal edilsin mi?"
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Siparişi iptal et
            </ConfirmButton>
          </form>
        )}
      </div>

      {/* Kesin fiyat — Mesafeli Söz. Yön. md.15/1-h: müşterinin ifaya başlama
          onayı ispatlı olsun diye fiyat bildirilir, müşteri takipten onaylar. */}
      {!closed && (o.status === "PICKED_UP" || o.quotedPrice != null) && (
        <div className={card}>
          <h2 className="font-semibold text-slate-900">Kesin Fiyat</h2>
          {o.priceApprovedAt ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              <IconCheck size={14} className="shrink-0" />
              Müşteri onayladı: {Number(o.quotedPrice)} TL (
              {fmt(o.priceApprovedAt)})
            </p>
          ) : (
            <>
              {/* "müşteriye SMS gider" YALANDI (2026-07-29): SMS_MODE=mock,
                  hiçbir SMS gitmiyor. Halıcı fiyatı bildirip müşterinin haber
                  aldığını sanıyor, müşteri onaylamayınca sipariş asılı kalıyordu.
                  ManualOrderForm'daki ikizi de aynı gün düzeltildi. */}
              {o.quotedPrice != null ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                  Bildirilen fiyat: {Number(o.quotedPrice)} TL — müşteri onayı
                  bekleniyor.
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  Ölçüm sonrası kesin fiyatı bildir — müşteri takip sayfasından
                  onaylar ve onay kayda geçer. <strong>Müşteriye haber
                  vermeyi unutma:</strong> fiyatı bildirdiğini kendisi görmeyebilir,
                  takip linkini yollamak en hızlısı.
                </p>
              )}
              {o.status === "PICKED_UP" && (
                <form
                  action={quoteOrderPrice}
                  className="mt-3 flex items-end gap-2"
                >
                  <input type="hidden" name="orderId" value={o.id} />
                  <div>
                    <label
                      htmlFor="kesin-fiyat"
                      className="block text-xs font-medium text-slate-500"
                    >
                      Kesin fiyat (TL)
                    </label>
                    <div className="mt-0.5 w-40">
                      <MoneyInput
                        id="kesin-fiyat"
                        name="price"
                        required
                        defaultValue={
                          o.quotedPrice != null ? String(o.quotedPrice) : ""
                        }
                        placeholder="Ör. 850"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
                      />
                    </div>
                  </div>
                  <PendingButton className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60">
                    {o.quotedPrice != null ? "Fiyatı güncelle" : "Fiyatı bildir"}
                  </PendingButton>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {/* Tahmini teslim + şoför */}
      {!closed && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={card}>
            <h2 className="font-semibold text-slate-900">Tahmini teslim</h2>
            <p className="mt-1 text-sm text-slate-600">
              {o.estimatedDays
                ? `Müşteriye ~${o.estimatedDays} gün olarak gösteriliyor.`
                : "Henüz belirtilmedi — müşteriye süre ver, güven artar."}
            </p>
            <form action={setOrderEta} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="orderId" value={o.id} />
              <div>
                <label
                  htmlFor="eta-gun"
                  className="block text-xs font-medium text-slate-500"
                >
                  Gün
                </label>
                <input
                  id="eta-gun"
                  name="days"
                  type="number"
                  min="1"
                  max="60"
                  defaultValue={o.estimatedDays ?? ""}
                  required
                  className="mt-0.5 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand"
                />
              </div>
              <PendingButton className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-light/50 disabled:opacity-60">
                Kaydet
              </PendingButton>
            </form>
          </div>

          <div className={card}>
            <h2 className="font-semibold text-slate-900">Şoför</h2>
            <p className="mt-1 text-sm text-slate-600">
              {o.driver ? o.driver.user.name : "Atanmamış"}
            </p>
            <form action={reassignOrder} className="mt-3 flex items-end gap-2">
              <input type="hidden" name="orderId" value={o.id} />
              <select
                name="driverId"
                defaultValue={o.driverId ?? ""}
                aria-label="Şoför ata"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="">(atanmamış)</option>
                {b.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user.name}
                  </option>
                ))}
              </select>
              <PendingButton className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">
                Ata
              </PendingButton>
            </form>
          </div>
        </div>
      )}

      {/* Fotoğraflar — FOTOĞRAFLA EŞLEŞTİRME (QR/barkod yerine seçilen çözüm).
          Yıkama sırasında çekilen kareler "YIKAMA" aşamasına bağlanır; müşteri
          takip sayfasında aynı galeriyi aynı etiketlerle görür. */}
      <div className={card}>
        {/* Sayaç yok: galeri yerel state ile anında güncelleniyor; sunucudan
            gelen sabit sayı yükleme sonrası yanıltıcı kalırdı. */}
        <h2 className="font-semibold text-slate-900">
          {o.status === "WASHING" ? "Fotoğraflar · Yıkama" : "Fotoğraflar"}
        </h2>
        {o.status === "WASHING" && (
          <p className="mt-1 text-sm text-slate-600">
            Halı yıkanırken fotoğraf çek — müşteri işin yapıldığını görür,
            tesiste “bu kimin halısı” sorusu fotoğrafla cevaplanır.
          </p>
        )}
        <div className="mt-3">
          <OrderPhotoManager
            orderId={o.id}
            photos={o.photos.map((p) => ({
              id: p.id,
              url: p.url,
              stage: p.stage,
              carpetNo: p.carpetNo,
              createdAt: p.createdAt.toISOString(),
            }))}
            uploadStage={o.status === "WASHING" ? "YIKAMA" : undefined}
          />
        </div>
        {/* "Hazır" haberi (2026-07-31): siparis_hazir şablonu onaylıydı ama
            hiçbir olaya bağlı değildi. İsteğe bağlı, sipariş başına BİR KEZ —
            gönderilmişse geçmiş satırından anlaşılır ve düğme kaybolur. */}
        {o.status === "WASHING" &&
          (o.events.some((e) => e.note?.startsWith("Hazır haberi")) ? (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              ✓ Müşteriye &quot;halın yıkandı, teslime hazır&quot; haberi
              gönderildi.
            </p>
          ) : (
            <form action={notifyOrderReady} className="mt-3">
              <input type="hidden" name="orderId" value={o.id} />
              <PendingButton className="w-full rounded-lg border border-brand bg-white px-4 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-light active:scale-[0.99] disabled:opacity-60 sm:w-auto">
                Müşteriye haber ver — halın yıkandı, teslime hazır
              </PendingButton>
              <p className="mt-1 text-xs text-slate-500">
                WhatsApp + e-posta gider; bir kez gönderilir. Teslimata
                çıkardığında ayrıca &quot;yolda&quot; bildirimi gidecek.
              </p>
            </form>
          ))}
      </div>

      {/* İşlem geçmişi */}
      <div className={card}>
        <h2 className="font-semibold text-slate-900">İşlem geçmişi</h2>
        <ul className="mt-3 space-y-2">
          {o.events.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex items-center gap-2 text-slate-700">
                <OrderStatusIcon status={e.status} size={14} />
                {e.note ?? ORDER_STATUS_META[e.status].label}
              </span>
              <span className="whitespace-nowrap text-xs text-slate-500">
                {fmt(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

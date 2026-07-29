import { redirect } from "next/navigation";
import MoneyInput from "@/components/MoneyInput";
import { PendingButton } from "@/components/PendingButton";
import { PhotoForm } from "@/components/PhotoForm";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { DriverShift } from "@/components/DriverShift";
import { ORDER_STATUS_META, DRIVER_NEXT, REJECT_REASONS } from "@/lib/orderStatus";
import {
  OrderStatusIcon,
  IconPackage,
  IconTruck,
  IconHome,
  IconMapPin,
  IconPhone,
} from "@/components/icons";
import EmptyState from "@/components/EmptyState";
import {
  acceptOrder,
  rejectOrder,
  savePickup,
  advanceOrder,
  deliverOrder,
} from "./actions";

export const dynamic = "force-dynamic";

const inp =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand";

export default async function SoforPage() {
  const u = await getSessionUser();
  if (!u) return null;
  // Telefonla giriş kaldırıldı: kimliği eksik şoför önce kullanıcı adı belirler.
  if (!u.username) redirect("/kullanici-adi");
  const driver = await prisma.driver.findUnique({ where: { userId: u.id } });
  if (!driver) return null;

  // KVKK Aydınlatma Tebliği md.6/1-b: şoförün verisi kendisinden değil
  // işletmesinden elde ediliyor → İLK İLETİŞİMDE (bu sayfada DriverShift
  // altındaki aydınlatma metniyle) bilgilendirilir; ilk gösterim anı ispat
  // için kaydedilir. updateMany + null koşulu: ilk zaman damgası ezilmez.
  if (!driver.privacyNoticeAt) {
    await prisma.driver.updateMany({
      where: { id: driver.id, privacyNoticeAt: null },
      data: { privacyNoticeAt: new Date() },
    });
  }

  const orders = await prisma.order.findMany({
    where: {
      driverId: driver.id,
      status: { notIn: ["DELIVERED", "CANCELED", "REJECTED"] },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <DriverShift initialOnShift={driver.isOnShift} />

      <h1 className="text-lg font-semibold text-slate-900">
        İşlerim ({orders.length})
      </h1>

      {orders.length === 0 && (
        <EmptyState
          icon={<IconTruck size={22} />}
          title="Şu an aktif iş yok"
          description="Halıcın sana yeni bir iş atadığında burada görünecek."
        />
      )}

      {orders.map((o) => {
        const meta = ORDER_STATUS_META[o.status];
        const next = DRIVER_NEXT[o.status];
        // Navigasyon telefonun harita uygulamasına devredilir: koordinat varsa
        // (müşteri "Konumumu ekle" dediyse) nokta hedefi, yoksa adres araması.
        const destination =
          o.pickupLat != null && o.pickupLng != null
            ? `${o.pickupLat},${o.pickupLng}`
            : encodeURIComponent(o.pickupAddress);
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
        return (
          <div
            key={o.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{o.customerName}</p>
                <p className="text-sm text-slate-500">{o.customerPhone}</p>
                <p className="mt-1 text-sm text-slate-600">{o.pickupAddress}</p>
                {o.approxM2 && (
                  <p className="text-xs text-slate-500">~{o.approxM2} m²</p>
                )}
                {o.note && (
                  <p className="mt-1 text-xs italic text-slate-500">{o.note}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Ödeme:{" "}
                  {o.paymentMethod === "CARD" ? "Kartla (platform)" : "Kapıda nakit"}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                <OrderStatusIcon status={o.status} size={13} /> {meta.label}
              </span>
            </div>

            {/* Sahada en çok gereken iki aksiyon: adrese navigasyon + müşteriyi arama.
                Yol tarifi telefonun harita uygulamasında (Google Maps) açılır,
                rota/navigasyonu o çizer. */}
            <div className="mt-3 flex gap-2">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.99]"
              >
                <IconMapPin size={15} /> Yol Tarifi
              </a>
              <a
                href={`tel:${o.customerPhone}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <IconPhone size={15} /> Müşteriyi Ara
              </a>
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              {/* CREATED: kabul / ret */}
              {o.status === "CREATED" && (
                <div className="space-y-2">
                  <form action={acceptOrder}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <PendingButton className="w-full rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                      İşi Kabul Et
                    </PendingButton>
                  </form>
                  <form action={rejectOrder} className="space-y-2">
                    <input type="hidden" name="orderId" value={o.id} />
                    <select name="reason" defaultValue="" className={inp} required>
                      <option value="" disabled>
                        Ret sebebi seç
                      </option>
                      {REJECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        name="note"
                        placeholder="Not (opsiyonel)"
                        className={inp}
                      />
                      <PendingButton className="whitespace-nowrap rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600">
                        Reddet
                      </PendingButton>
                    </div>
                  </form>
                </div>
              )}

              {/* ACCEPTED: halıyı aldım — sadece foto, PARA YOK */}
              {o.status === "ACCEPTED" && (
                <PhotoForm
                  action={savePickup}
                  orderId={o.id}
                  photoLabel={
                    <>
                      Aldığın halının fotoğrafını çek veya seç{" "}
                      <span className="text-red-600">
                        (zorunlu — hasar/kayıp kanıtı)
                      </span>
                    </>
                  }
                  errorMessage="Lütfen aldığınız halıyı fotoğraf ile doğrulayın — fotoğraf eklemeden devam edemezsiniz."
                  buttonLabel={
                    <>
                      <IconPackage size={16} /> Halıyı Aldım
                    </>
                  }
                  footer={
                    <p className="text-center text-xs text-slate-500">
                      Ödeme teslimde alınır.
                    </p>
                  }
                />
              )}

              {/* PICKED_UP / WASHING: ara adımlar (para yok) */}
              {(o.status === "PICKED_UP" || o.status === "WASHING") && next && (
                <form action={advanceOrder}>
                  <input type="hidden" name="orderId" value={o.id} />
                  {/* SÖZLÜ ONAY BEYANI (2026-07-28 denetim): sunucu bu alanı
                      okuyup sipariş geçmişine ispat kaydı yazıyordu ama ekranda
                      KUTU YOKTU — yani şoför sözlü onay almış olsa bile
                      belirtemiyordu, kayda hep "onay alınmadan geçildi"
                      düşüyordu. (Mobil uygulama ise tersini yapıp onayı
                      UYDURUYORDU; o da düzeltildi.) */}
                  {o.status === "PICKED_UP" && !o.priceApprovedAt && (
                    <label className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <input
                        type="checkbox"
                        name="verbalConsent"
                        className="mt-0.5 h-4 w-4 shrink-0"
                      />
                      <span>
                        Müşteri kesin fiyatı <strong>sözlü olarak</strong> onayladı.
                        Almadıysan işaretleme — bu kayıt anlaşmazlıkta delil olur.
                      </span>
                    </label>
                  )}
                  <PendingButton className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                    <OrderStatusIcon status={next} size={16} />
                    {next === "OUT_FOR_DELIVERY"
                      ? "Teslime çıktım"
                      : `${ORDER_STATUS_META[next].label} olarak işaretle`}
                  </PendingButton>
                  {next === "OUT_FOR_DELIVERY" && (
                    <p className="mt-1 text-center text-xs text-slate-500">
                      Müşteri artık seni canlı takip edebilecek.
                    </p>
                  )}
                </form>
              )}

              {/* OUT_FOR_DELIVERY: teslim + TAHSİLAT (para burada alınır) */}
              {o.status === "OUT_FOR_DELIVERY" && (
                <PhotoForm
                  action={deliverOrder}
                  orderId={o.id}
                  photoLabel={
                    <>
                      Bıraktığın halının fotoğrafını çek veya seç{" "}
                      <span className="text-red-600">
                        (zorunlu — teslim + hasar kanıtı)
                      </span>
                    </>
                  }
                  errorMessage="Lütfen bıraktığınız halıyı fotoğraf ile doğrulayın — fotoğraf eklemeden teslim edemezsiniz."
                  buttonLabel={
                    <>
                      <IconHome size={16} /> Teslim Et &amp; Tahsilatı Gir
                    </>
                  }
                  footer={
                    <p className="text-center text-xs text-slate-500">
                      Kapıda nakit tahsil et — teslim anında.
                    </p>
                  }
                >
                  {/* Halıcının bildirdiği/anlaştığı tutar HAZIR gelir — şoför
                      sıfırdan yazmasın, yanlış tahsilat olmasın (2026-07-26). */}
                  <MoneyInput
                    name="price"
                    required
                    defaultValue={
                      o.quotedPrice != null ? String(o.quotedPrice) : ""
                    }
                    placeholder="Tahsil edilen tutar"
                    className={inp}
                  />
                  {/* TAHSİLAT BEYANI (2026-07-29): nakit teslim eskiden
                      sessizce "ödendi" sayılıyordu. Kutu işaretli geliyor —
                      olağan akış değişmiyor — ama müşteri parayı vermediyse
                      şoför işareti kaldırır ve sipariş "tahsil edilmedi"
                      kalır. Gün sonu mutabakatı buna dayanıyor. */}
                  {o.paymentMethod === "CASH" && (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="collected"
                        defaultChecked
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Ücreti tahsil ettim
                    </label>
                  )}
                </PhotoForm>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

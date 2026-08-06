import { getPanelBusiness } from "@/lib/panel";
import { ManualOrderForm } from "@/components/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function YeniSiparisPage() {
  const b = await getPanelBusiness();
  if (!b) return null;
  const drivers = b.drivers.map((d) => ({ id: d.id, name: d.user.name }));
  // m² birim fiyatı (ana kalemlerin en düşüğü) — dükkânda ölçünce tutarı
  // önermek için. Yoksa öneri gösterilmez.
  const m2Fiyat =
    b.pricing
      .filter((p) => !p.isAddon && p.unit === "PER_M2")
      .map((p) => Number(p.price))
      .sort((a, b2) => a - b2)[0] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Yeni Müşteri / Sipariş Kaydı
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Dükkânına gelen müşterin için kayıt oluştur. Sistem bir{" "}
          <b>takip kodu</b> üretir; müşterin hiçbir şey bilmeden o kodla son
          durumu izler.
        </p>
      </div>
      <ManualOrderForm drivers={drivers} m2Fiyat={m2Fiyat} />
    </div>
  );
}

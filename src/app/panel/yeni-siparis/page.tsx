import { getCurrentBusiness } from "@/lib/panel";
import { ManualOrderForm } from "@/components/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function YeniSiparisPage() {
  const b = await getCurrentBusiness();
  if (!b) return null;
  const drivers = b.drivers.map((d) => ({ id: d.id, name: d.user.name }));

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
      <ManualOrderForm drivers={drivers} />
    </div>
  );
}

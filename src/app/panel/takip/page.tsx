import { PanelTrackingClient } from "@/components/PanelTrackingClient";
import { getPanelErisim } from "@/lib/panelYetki";
import { modulGerekir } from "@/lib/paketYetki";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PanelTakipPage() {
  // Çalışan şoförün NEREDE olduğunu görür (işinin parçası) ama şoför
  // YÖNETEMEZ — boş durumdaki "Şoför ekle" butonu ona gösterilmez (2026-08-06).
  const erisim = await getPanelErisim();
  const calisanMi = erisim?.rol === "STAFF";

  // PAKET KAPISI (FIYAT §1-C). Bu sayfa işletme kaydını yüklemiyor, yalnız
  // erişim biletini okuyor — o yüzden aboneliği burada tek sorguyla alıyoruz.
  // Sayfanın kendi verisi (konumlar) istemci tarafında ayrı uçtan geliyor ve
  // O UÇ DA ayrıca kilitli olmalı; yalnız bu sayfayı kapatmak yetmez.
  if (erisim) {
    const sub = await prisma.subscription.findUnique({
      where: { businessId: erisim.businessId },
      select: { status: true, currentPeriodEnd: true, plan: true },
    });
    modulGerekir(sub, "CANLI_KONUM");
  }

  return <PanelTrackingClient calisanMi={calisanMi} />;
}

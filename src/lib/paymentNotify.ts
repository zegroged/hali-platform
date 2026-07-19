import { prisma } from "@/lib/prisma";
import { sendEmail, sendAdminEmail, wrapEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { escapeHtml } from "@/lib/htmlSafe";
import { getAppBaseUrl } from "@/lib/config";

// Abonelik ödemesi BAŞARILI olunca otomatik bilgilendirme (best-effort —
// ödeme kaydını asla geriye döndürmez, hata yalnız loglanır):
//   1) İşletmeye e-posta: makbuz + dönem sonu + "faturan kesilecek" notu
//   2) İşletmeye panel zili
//   3) Admin'e e-posta: FATURA KES aksiyonu (mali müşavir akışı manuel —
//      ödemeden haberdar olmazsa fatura kesilmez).
export async function notifySubscriptionPaid(opts: {
  businessId: string;
  amount: number; // KDV dahil tahsil edilen
  periodEnd: Date | null;
  iyzicoPaymentId?: string | null;
  kind: "ilk-odeme" | "yenileme";
}): Promise<void> {
  try {
    const b = await prisma.cleanerBusiness.findUnique({
      where: { id: opts.businessId },
      select: {
        name: true,
        billingCode: true,
        billingTitle: true,
        taxNumber: true,
        taxOffice: true,
        billingAddress: true,
        address: true,
        owner: { select: { id: true, email: true, name: true } },
      },
    });
    if (!b) return;

    const tutar = opts.amount.toLocaleString("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const donemSonu = opts.periodEnd
      ? opts.periodEnd.toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";
    const baslik =
      opts.kind === "yenileme"
        ? "Abonelik yenilendi — ödemen alındı"
        : "Ödemen alındı — aboneliğin aktif";

    // 1) İşletmeye makbuz e-postası
    if (b.owner.email) {
      await sendEmail(
        b.owner.email,
        `${baslik} · ${tutar} TL`,
        `Merhaba ${b.owner.name}, ${tutar} TL abonelik ödemen alındı. Aboneliğin ${donemSonu} tarihine kadar geçerli. Faturan, panelindeki fatura bilgilerine göre düzenlenip bu e-postaya iletilecek. Cari kodun: ${b.billingCode ?? "-"}.`,
        wrapEmail(
          `<p style="margin:0 0 12px;">Merhaba ${escapeHtml(b.owner.name)},</p>
           <p style="margin:0 0 12px;"><strong>${escapeHtml(tutar)} TL</strong> abonelik ödemen alındı — teşekkürler! Aboneliğin <strong>${escapeHtml(donemSonu)}</strong> tarihine kadar geçerli.</p>
           <p style="margin:0 0 12px;">Faturan, panelinde kayıtlı fatura bilgilerine göre düzenlenip bu e-posta adresine iletilecek. Cari (abone) kodun: <strong>${escapeHtml(b.billingCode ?? "-")}</strong></p>
           <p style="margin:0;"><a href="${getAppBaseUrl()}/panel/abonelik" style="color:#0f766e;">Abonelik durumun ve ödeme geçmişin →</a></p>`,
        ),
      ).catch((e) => console.error("ödeme makbuz e-postası:", e));
    }

    // 2) Panel zili
    await notify({
      userId: b.owner.id,
      type: "genel",
      title: baslik,
      body: `${tutar} TL · dönem sonu: ${donemSonu}`,
      href: "/panel/abonelik",
    }).catch(() => {});

    // 3) Admin'e FATURA KES maili (mali müşavire iletilecek aksiyon)
    const satirlar = [
      `İşletme: ${b.name} (${b.billingCode ?? "kodsuz"})`,
      `Tutar: ${tutar} TL (KDV dahil) · ${opts.kind === "yenileme" ? "aylık yenileme" : "ilk ödeme"}`,
      `Dönem sonu: ${donemSonu}`,
      `Ünvan: ${b.billingTitle ?? "-"}`,
      `VKN/TCKN: ${b.taxNumber ?? "-"} · Vergi dairesi: ${b.taxOffice ?? "-"}`,
      `Fatura adresi: ${b.billingAddress ?? b.address}`,
      `E-posta (fatura gönderimi): ${b.owner.email ?? "-"}`,
      opts.iyzicoPaymentId ? `iyzico paymentId: ${opts.iyzicoPaymentId}` : "",
    ].filter(Boolean);
    await sendAdminEmail(
      `FATURA KES — ${b.name} · ${tutar} TL ödedi`,
      satirlar.map((s) => escapeHtml(s)).join("<br/>"),
    ).catch((e) => console.error("admin fatura maili:", e));
  } catch (e) {
    console.error("notifySubscriptionPaid:", e);
  }
}

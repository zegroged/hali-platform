import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBusiness,
  completenessChecklist,
  verificationReady,
} from "@/lib/panel";
import { submitForVerification, acceptContract } from "./actions";
import { EmailVerify } from "@/components/EmailVerify";
import { IconCheck } from "@/components/icons";

const VERIF_META: Record<string, { label: string; cls: string }> = {
  VERIFIED: { label: "Doğrulanmış ✓", cls: "bg-green-100 text-green-700" },
  PENDING: { label: "Onay bekliyor", cls: "bg-amber-100 text-amber-700" },
  REJECTED: { label: "Reddedildi", cls: "bg-red-100 text-red-700" },
};

export default async function PanelHome() {
  const b = await getCurrentBusiness();
  if (!b) return null;

  const [pendingOrders, activeOrders] = await Promise.all([
    prisma.order.count({ where: { businessId: b.id, status: "CREATED" } }),
    prisma.order.count({
      where: {
        businessId: b.id,
        status: { in: ["ACCEPTED", "PICKED_UP", "WASHING", "OUT_FOR_DELIVERY"] },
      },
    }),
  ]);
  const onShift = b.drivers.filter((d) => d.isOnShift).length;
  const checklist = completenessChecklist(b);
  const ready = verificationReady(b);
  const verif = VERIF_META[b.verification];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${verif.cls}`}>
          {verif.label}
        </span>
        {b.isVisible ? (
          <span className="text-sm text-green-700">Müşterilere görünür</span>
        ) : (
          <span className="text-sm text-slate-400">Henüz görünmüyor</span>
        )}
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/panel/siparisler"
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="text-2xl font-bold text-brand-dark">{pendingOrders}</div>
          <div className="text-xs text-slate-500">Yeni talep</div>
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-slate-900">{activeOrders}</div>
          <div className="text-xs text-slate-500">Süren iş</div>
        </div>
        <Link
          href="/panel/soforler"
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="text-2xl font-bold text-slate-900">
            {onShift}/{b.drivers.length}
          </div>
          <div className="text-xs text-slate-500">Mesaide şoför</div>
        </Link>
      </div>

      {/* Abonelik */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">Abonelik</p>
            <p className="text-sm text-slate-500">
              {b.subscription?.status === "ACTIVE"
                ? "Aktif"
                : b.subscription?.status ?? "Yok"}{" "}
              · {b.subscription ? Number(b.subscription.priceMonthly) : 2000} TL/ay
            </p>
          </div>
          <span className="text-2xl">💳</span>
        </div>
      </div>

      {/* Profil tamamlama */}
      {b.verification !== "VERIFIED" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-medium text-slate-900">Profilini tamamla</p>
          <p className="mt-1 text-sm text-slate-500">
            Doğrulanıp müşterilere görünmek için aşağıdakileri tamamla:
          </p>
          <ul className="mt-3 space-y-1.5">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full ${
                    c.done
                      ? "bg-green-100 text-green-600"
                      : "border border-slate-300"
                  }`}
                >
                  {c.done && <IconCheck size={11} />}
                </span>
                <span className={c.done ? "text-slate-700" : "text-slate-400"}>
                  {c.label}
                </span>
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

          {/* Sözleşme onayı */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm font-medium text-slate-700">
              Platform sözleşmesi
            </span>
            {b.contractAcceptedAt ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                <IconCheck size={15} /> Onaylandı
              </span>
            ) : (
              <form action={acceptContract}>
                <button className="rounded-lg border border-brand px-3 py-1.5 text-sm font-medium text-brand-dark">
                  Sözleşmeyi onayla
                </button>
              </form>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
            <Link
              href="/panel/profil"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              Profili düzenle
            </Link>
            {ready && b.verification !== "PENDING" ? (
              <form action={submitForVerification}>
                <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
                  Doğrulamaya gönder
                </button>
              </form>
            ) : (
              b.verification !== "PENDING" && (
                <span className="text-xs text-slate-400">
                  Tümünü tamamlayınca gönderebilirsin
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

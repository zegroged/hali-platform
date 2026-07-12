import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { ORDER_STATUS_META } from "@/lib/orderStatus";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Hesabım",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function HesabimPage() {
  const u = await getSessionUser();
  if (!u) redirect("/uye-ol?donus=/hesabim");
  // Yalnız müşteri hesabı; halıcı/şoför/admin kendi paneline.
  if (u.role !== "CUSTOMER") {
    redirect(
      u.role === "CLEANER"
        ? "/panel"
        : u.role === "DRIVER"
          ? "/sofor"
          : u.role === "ADMIN"
            ? "/admin"
            : "/",
    );
  }

  const [me, orders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: u.id },
      select: { name: true, points: true, phone: true },
    }),
    prisma.order.findMany({
      where: { customerId: u.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        code: true,
        trackingToken: true,
        status: true,
        customerName: true,
        createdAt: true,
        business: { select: { name: true } },
        review: { select: { rating: true } },
      },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-slate-500">Hesabım</p>
            <p className="font-semibold text-slate-900">{me?.name}</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
        {/* Puan kartı */}
        <div className="rounded-xl border border-brand bg-brand-light/40 p-5">
          <p className="text-sm text-slate-600">Ödül puanların</p>
          <p className="mt-1 text-3xl font-bold text-brand-dark">
            {me?.points ?? 0}{" "}
            <span className="text-base font-medium text-slate-500">puan</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Teslim edilen siparişlerine yorum yaparak puan kazanırsın. Puanların
            ileride indirim/ödül olarak kullanılabilecek — çok yakında.
          </p>
        </div>

        {/* Siparişler */}
        <div>
          <h2 className="mb-2 font-semibold text-slate-900">Siparişlerim</h2>
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm text-slate-500">
                Henüz siparişin yok. Bir halıcı seçip halını aldır.
              </p>
              <Link
                href="/"
                className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Halıcı bul
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => {
                const meta = ORDER_STATUS_META[o.status];
                const ref = o.code ?? o.trackingToken;
                return (
                  <Link
                    key={o.id}
                    href={`/takip/${ref}`}
                    className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {o.business.name}
                      </span>
                      <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {meta?.label ?? o.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Kod: {ref} ·{" "}
                      {new Date(o.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                    {o.status === "DELIVERED" && (
                      <p className="mt-1 text-xs">
                        {o.review ? (
                          <span className="text-amber-500">
                            {"★".repeat(o.review.rating)}
                            <span className="text-slate-300">
                              {"★".repeat(5 - o.review.rating)}
                            </span>
                          </span>
                        ) : (
                          <span className="font-medium text-brand-dark">
                            Değerlendir, 50 puan kazan →
                          </span>
                        )}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

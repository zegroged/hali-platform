import type { Metadata } from "next";
import { TrackingClient } from "@/components/TrackingClient";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

// Token'lı müşteri sayfası — kişisel bilgi içerir, arama motorlarına kapalı.
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Sipariş Takibi",
    robots: { index: false, follow: false },
  };
}

export default async function TakipPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <TrackingClient token={token} />
      </main>
      <Footer />
    </div>
  );
}

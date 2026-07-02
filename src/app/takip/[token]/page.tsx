import { TrackingClient } from "@/components/TrackingClient";

export const dynamic = "force-dynamic";

export default async function TakipPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <TrackingClient token={token} />
    </main>
  );
}

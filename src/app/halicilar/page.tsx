import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Eski liste adresi artık ana sayfaya yönleniyor (halıcılar orada listeleniyor).
export default async function HalicilarRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ["district", "lat", "lng", "q"]) {
    const v = sp[k];
    if (v) qs.set(k, String(v));
  }
  redirect(qs.toString() ? `/?${qs.toString()}` : "/");
}

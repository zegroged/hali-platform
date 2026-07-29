"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { parseTutar } from "@/lib/money";

// ŞOFÖRDEN NAKİT TESLİM ALMA (2026-07-29).
//
// "Şoför üzerindeki nakit" bir bayrak değil BAKİYE: tahsil ettikçe artar,
// halıcıya verdikçe kapanır. Para siparişten bağımsız, toplu devrediliyor
// ("bugünkü 8.400'ü akşam verdim") — o yüzden siparişe konan tek bir işaret
// bunu gösteremez, ayrı kayıt gerekiyor (CashHandover).

async function biz() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  return b;
}

export async function nakitTeslimAl(formData: FormData) {
  const b = await biz();
  const driverId = String(formData.get("driverId") || "").trim() || null;
  const tutar = parseTutar(formData.get("amount"));
  const note = String(formData.get("note") || "").trim() || null;

  if (!Number.isFinite(tutar) || tutar <= 0) {
    redirect(
      "/panel/mutabakat?hata=" +
        encodeURIComponent("Geçerli bir tutar gir (0'dan büyük)."),
    );
  }

  // 🔴 İZOLASYON: şoför BU işletmeye ait olmalı. Aksi hâlde halıcı, formu
  // kurcalayıp başka işletmenin şoförüne kayıt açabilir ve o işletmenin
  // mutabakatını bozar.
  let driverName = "Panelden (halıcı)";
  if (driverId) {
    const d = await prisma.driver.findFirst({
      where: { id: driverId, businessId: b.id },
      // Şoför adı User tablosunda — Driver.name yok.
      select: { user: { select: { name: true } } },
    });
    if (!d) {
      redirect(
        "/panel/mutabakat?hata=" +
          encodeURIComponent("Şoför bulunamadı."),
      );
    }
    driverName = d.user.name;
  }

  await prisma.cashHandover.create({
    data: {
      businessId: b.id,
      driverId,
      // Kayıt anındaki ad: şoför silinse bile geçmiş okunabilir kalsın.
      driverName,
      amount: tutar,
      note,
    },
  });

  revalidatePath("/panel/mutabakat");
  redirect(
    "/panel/mutabakat?ok=" +
      encodeURIComponent(`${driverName} — ${tutar} TL teslim alındı`),
  );
}

export async function nakitTeslimSil(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id") || "");
  // businessId koşulu ŞART: id tahmin edilerek başka işletmenin kaydı silinmesin.
  await prisma.cashHandover.deleteMany({ where: { id, businessId: b.id } });
  revalidatePath("/panel/mutabakat");
  redirect("/panel/mutabakat?ok=" + encodeURIComponent("Kayıt silindi"));
}

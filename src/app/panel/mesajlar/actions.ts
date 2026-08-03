"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentBusiness } from "@/lib/panel";
import { demoWaBagla, demoWaCoz } from "@/lib/demoWa";

// DEMO WHATSAPP BAĞI — komisyoncunun saha aracı (bkz. lib/demoWa.ts).
// Yalnız demo panelinde çalışır; gerçek işletmede sessizce reddedilir.

async function demoIsletme() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  if (!b.isDemo) redirect("/panel/mesajlar");
  return b;
}

export async function demoWaBaglaAction(formData: FormData) {
  const b = await demoIsletme();
  const ham = String(formData.get("phone") ?? "");
  const sonuc = await demoWaBagla(b.id, ham);
  revalidatePath("/panel/mesajlar");
  if (!sonuc.ok) redirect("/panel/mesajlar?hata=" + encodeURIComponent(sonuc.hata));
  redirect(
    "/panel/mesajlar?kaydedildi=" +
      encodeURIComponent("Demo bu numaraya bağlandı — mesajlar artık gerçekten gidiyor."),
  );
}

export async function demoWaCozAction() {
  const b = await demoIsletme();
  await demoWaCoz(b.id);
  revalidatePath("/panel/mesajlar");
  redirect(
    "/panel/mesajlar?kaydedildi=" + encodeURIComponent("Bağ kaldırıldı, demo verisi eski hâline döndü."),
  );
}

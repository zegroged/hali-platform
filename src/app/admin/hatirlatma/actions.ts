"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import {
  getSezonAyar,
  setSezonAyar,
  sendSeasonReminders,
} from "@/lib/seasonReminder";

// SEZON HATIRLATMASI — YALNIZ ADMİN (işletme sahibi kararı, 2026-07-30):
// "otomatik müdahaleyi sadece admin yapabilsin". Her aksiyon rolü kendisi
// doğrular; layout'un redirect'ine güvenilmez.

async function adminSart() {
  const u = await getSessionUser();
  if (!u || u.role !== "ADMIN") redirect("/giris");
  return u;
}

/** Aç/kapa + aralık (ay) tek formdan. */
export async function sezonAyarKaydet(formData: FormData) {
  await adminSart();
  const acik = formData.get("acik") === "1";
  const ayHam = Number(formData.get("ay"));
  const ay = Number.isFinite(ayHam) ? Math.floor(ayHam) : NaN;
  if (!Number.isFinite(ay) || ay < 1 || ay > 24) {
    redirect("/admin/hatirlatma?hata=" + encodeURIComponent("Aralık 1-24 ay olmalı."));
  }
  await setSezonAyar({ acik, ay });
  revalidatePath("/admin/hatirlatma");
  redirect(
    "/admin/hatirlatma?ok=" +
      encodeURIComponent(acik ? `Açıldı — her gün denetlenir, ${ay} ayı dolan müşteriye yazılır.` : "Kapatıldı — otomatik gönderim durdu."),
  );
}

/** Elle tetikle — anahtar kapalıyken de çalışır (adminin açık iradesi). */
export async function sezonElleTetikle() {
  await adminSart();
  const ayar = await getSezonAyar();
  const r = await sendSeasonReminders({ elle: true });
  revalidatePath("/admin/hatirlatma");
  // Sonuç DÜRÜST anlatılır (denetim bulgusu: kanallar başarısızken "gönderilecek
  // müşteri yok" deniyordu — admin sorunun farkına varamazdı).
  let mesaj: string;
  if (r.kilitli) {
    mesaj =
      "Bir gönderim turu ZATEN sürüyor (elle ya da günlük otomatik) — yenisi başlatılmadı. Birkaç dakika sonra son çalışma kaydına bak.";
  } else if (r.gonderilen > 0) {
    mesaj =
      `${r.gonderilen} müşteriye gönderildi.` +
      (r.ulasilamayan > 0
        ? ` ${r.ulasilamayan} müşteriye ulaşılamadı (WhatsApp şablonu onaysız ve e-postası yok olabilir).`
        : "");
  } else if (r.ulasilamayan > 0) {
    mesaj = `Hiç gönderilemedi — ${r.ulasilamayan} müşteri listede ama hiçbir kanala ulaşılamadı (WhatsApp şablonu Meta onayında olabilir; e-postası olmayan müşteriye şu an yazılamaz).`;
  } else {
    mesaj = `Gönderilecek müşteri yok (${ayar.ay} ay eşiği).`;
  }
  redirect("/admin/hatirlatma?ok=" + encodeURIComponent(mesaj));
}

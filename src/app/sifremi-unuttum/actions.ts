"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sifreBiletiGonder } from "@/lib/passwordReset";
import { rateLimit } from "@/lib/ratelimit";

/**
 * Sıfırlama bağlantısı iste. HESAP İFŞASI YOK: kimlik ne olursa olsun aynı
 * cevap döner (kayıtlıysa e-posta gider, değilse sessizce hiçbir şey olmaz).
 * Rate limit hem IP hem kimlik bazında — e-posta bombardımanı olmasın.
 */
export async function biletIste(formData: FormData) {
  const kimlik = String(formData.get("kimlik") || "").trim();
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "?";

  const rlIp = rateLimit(`sifre-bilet-ip:${ip}`, 10, 60 * 60 * 1000);
  const rlKimlik = rateLimit(
    `sifre-bilet:${kimlik.toLowerCase()}`,
    3,
    60 * 60 * 1000,
  );
  if (!rlIp.ok || !rlKimlik.ok)
    redirect(
      "/sifremi-unuttum?hata=" +
        encodeURIComponent(
          "Çok fazla istek — bir süre sonra tekrar dene. (Bağlantı zaten gönderildiyse e-postanı kontrol et.)",
        ),
    );

  // Gönderim hatası kullanıcıya sızmaz: aksi hâlde "bu e-posta kayıtlı mı"
  // sorusu hata farkından anlaşılırdı.
  try {
    await sifreBiletiGonder(kimlik);
  } catch (e) {
    console.error("sifre bileti gonderilemedi:", e);
  }
  redirect("/sifremi-unuttum?ok=1");
}

"use server";

import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/auth";
import { biletiKullan } from "@/lib/passwordReset";

/** E-postadaki bağlantıyla gelen yeni şifreyi yaz (oturum gerekmez). */
export async function sifreyiYaz(formData: FormData) {
  const jeton = String(formData.get("jeton") || "");
  const yeni = String(formData.get("yeni") || "");
  const tekrar = String(formData.get("tekrar") || "");
  const geri = (m: string): never => {
    redirect(
      `/sifre-sifirla?jeton=${encodeURIComponent(jeton)}&hata=` +
        encodeURIComponent(m),
    );
  };
  if (yeni.length < 8) geri("Yeni şifre en az 8 karakter olmalı.");
  if (yeni.length > 72) geri("Yeni şifre en fazla 72 karakter olabilir.");
  if (yeni !== tekrar) geri("Yeni şifre ile tekrarı aynı değil.");

  const sonuc = await biletiKullan(jeton, await hashPassword(yeni));
  if (!sonuc.ok) geri(sonuc.hata);
  redirect(
    "/giris?mesaj=" +
      encodeURIComponent("Şifren değiştirildi — yeni şifrenle giriş yap."),
  );
}

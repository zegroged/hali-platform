// KULLANICIYA SEBEBİNİ SÖYLEYEN HATA (2026-08-06).
//
// SORUN (kullanıcı bildirdi, canlıda yaşandı): çalışan eklenemiyordu ve ekranda
// yalnız "Bir şeyler ters gitti — Hata kodu: 2763219536" yazıyordu. Gerçek sebep
// sunucu logunda duruyordu: *"Bu telefon numarası başka bir hesapta zaten
// kayıtlı."* Yani sistem sebebi BİLİYORDU ama kullanıcıya söylemiyordu.
//
// KÖK NEDEN: server action içinde `throw new Error("...")`. Next üretim modunda
// hata mesajını KASITLI OLARAK gizler (iç detay sızmasın diye) ve yerine
// jenerik hata sayfası + `digest` kodu gösterir. Bu davranış GERÇEK çökmeler
// için doğrudur — ama bizim fırlattıklarımızın çoğu çökme değil, kullanıcının
// kendi düzeltebileceği doğrulama uyarısı ("şifre en az 8 karakter",
// "bu kullanıcı adı alınmış", "önce kesin fiyatı bildir"). Onları gizlemek
// kullanıcıyı çaresiz bırakıyor.
//
// ÇÖZÜM: iki hata sınıfını AYIR.
//   · BEKLENEN (kullanıcı düzeltebilir) → `hataylaDon()`: geldiği sayfaya
//     `?hata=` ile döner, sayfa mesajı kırmızı şeritte GÖSTERİR.
//   · BEKLENMEYEN (gerçek çökme: DB düştü, disk doldu) → `throw` kalır;
//     jenerik ekran + digest doğru davranıştır, kod loga düşer.
//
// ⚠️ `redirect()` Next içinde NEXT_REDIRECT fırlatarak çalışır — bu yüzden
// `hataylaDon` asla dönmez (`never`). try/catch içine ALMAYIN, yoksa
// yönlendirme yutulur.

import { redirect } from "next/navigation";

/**
 * Beklenen hata: kullanıcıyı geldiği sayfaya döndür ve SEBEBİ yaz.
 *
 * @param sayfa  Dönülecek yol (ör. "/panel/calisanlar")
 * @param mesaj  Kullanıcının okuyacağı Türkçe sebep — ne yapması gerektiğini
 *               de söylesin ("...başka bir numara girin" gibi).
 */
export function hataylaDon(sayfa: string, mesaj: string): never {
  const ayrac = sayfa.includes("?") ? "&" : "?";
  redirect(`${sayfa}${ayrac}hata=${encodeURIComponent(mesaj)}`);
}

/** Aynısının başarı hâli — "kaydedildi" geri bildirimi için. */
export function basariylaDon(sayfa: string, mesaj: string): never {
  const ayrac = sayfa.includes("?") ? "&" : "?";
  redirect(`${sayfa}${ayrac}kaydedildi=${encodeURIComponent(mesaj)}`);
}

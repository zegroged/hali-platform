// EKSİK ALANA GÖTÜR — TEK KAYNAK (2026-08-06).
//
// SORUN (kullanıcı): *"en son bir şey eksik olduğunda eksik olan şeyin
// paneline versin."* Formlar eksik alanları işaretliyor ve altta "Lütfen
// işaretli alanları düzelt" yazıyordu — ama SAYFA KAYDIRILMIYOR, odak
// verilmiyordu. Telefonda uzun formda eksik alan ekranın dışında kalınca
// kullanıcı hatayı görüyor, NEREDE olduğunu bulamıyordu.
//
// Buraya konmasının sebebi: aynı davranış sipariş formunda, panel yeni
// sipariş formunda ve profil formunda ayrı ayrı yazılırsa biri güncellenip
// öteki unutulur (bu depoda tam bu hata bildirimlerde yaşandı).

/**
 * İlk hatalı alana kaydır ve odakla.
 *
 * @param alanAdlari  Formdaki alanların DOĞAL SIRASI (yukarıdan aşağı).
 *                    Hata nesnesinin anahtar sırası güvenilir değildir;
 *                    kullanıcı ekranda ilk gördüğü eksiğe gitmeli.
 * @param hatalar     Alan adı → mesaj eşlemesi (boş olanlar yok sayılır).
 * @param kapsam      Aranacak kök (varsayılan: belge). Form elemanı verilirse
 *                    aynı sayfadaki başka formun alanına atlanmaz.
 */
export function ilkHataliAlanaGit(
  alanAdlari: readonly string[],
  hatalar: Record<string, string | undefined>,
  kapsam?: HTMLElement | null,
): void {
  const ilk = alanAdlari.find((ad) => hatalar[ad]);
  if (!ilk) return;
  const kok: ParentNode = kapsam ?? document;
  const el = kok.querySelector<HTMLElement>(
    `[name="${ilk}"], #${CSS.escape(ilk)}`,
  );
  if (!el) return;

  // `block: "center"` — alanı ekranın ortasına al. "start" kullanılırsa
  // sticky başlığın altında kalıp yine görünmüyordu.
  el.scrollIntoView({ behavior: "smooth", block: "center" });

  // Odak, kaydırma bitmeden verilirse tarayıcı kendi zıplamasını yapıp
  // yumuşak kaydırmayı bozuyor; bir kare bekle.
  requestAnimationFrame(() => {
    // preventScroll: yukarıdaki scrollIntoView zaten konumlandırdı.
    el.focus({ preventScroll: true });
  });
}

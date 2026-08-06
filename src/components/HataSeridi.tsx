// HATA / BAŞARI ŞERİDİ — TEK KAYNAK (2026-08-06).
//
// Her panel sayfası `?hata=` ve `?kaydedildi=` parametrelerini AYNI görünümde
// göstersin diye. Önceden yalnız /panel/profil'de vardı ve her sayfa kendi
// işaretlemesini yazıyordu; sonuç: çoğu sayfada hiç gösterilmiyordu ve
// kullanıcı "Bir şeyler ters gitti" jenerik ekranıyla baş başa kalıyordu.
//
// `role="alert"`: ekran okuyucu hatayı ANINDA okur; sessiz kırmızı kutu
// görme güçlüğü olan kullanıcı için yok hükmündedir.

export function HataSeridi({ mesaj }: { mesaj?: string }) {
  if (!mesaj) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
    >
      {mesaj}
    </p>
  );
}

export function BasariSeridi({ mesaj }: { mesaj?: string }) {
  if (!mesaj) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      {mesaj}
    </p>
  );
}

// GELEN WHATSAPP MEDYASI — PANELDE GÖSTER (2026-08-07 akşam).
//
// İşletme sahibi canlıda: *"konuşma çalışıyor ama fotoğraflar gözükmüyor,
// müşteri 'halımın şurasında leke var' diye fotoğraf atarsa ne yapacağız?"*
// Dosya artık indirilip saklanıyor (lib/whatsappMedya.ts); burada gösteriliyor.
//
// Panel ve admin gelen kutusu AYNI bileşeni kullanır — biri düzelip öteki
// unutulmasın (DEVIR'in "tek kaynağın iki tüketicisi" dersi).

/**
 * @param url  kendi depomuzdaki adres (/uploads/wa/...)
 * @param tur  MIME (image/webp, audio/ogg, video/mp4, application/pdf…)
 */
export function WaMedya({ url, tur }: { url: string; tur: string | null }) {
  const t = tur ?? "";

  if (t.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        {/* Büyütmek için tıklanır: leke/hasar tartışmasında ayrıntı gerekir. */}
        <img
          src={url}
          alt="Müşterinin gönderdiği fotoğraf"
          loading="lazy"
          className="max-h-64 w-auto max-w-full rounded-lg border border-black/5 object-contain"
        />
      </a>
    );
  }

  if (t.startsWith("audio/")) {
    // Sesli mesaj Türkiye'de en az fotoğraf kadar sık — panelden dinlenebilmeli.
    return <audio controls preload="none" src={url} className="mt-1 w-full max-w-xs" />;
  }

  if (t.startsWith("video/")) {
    return (
      <video
        controls
        preload="metadata"
        src={url}
        className="mt-1 max-h-64 w-full max-w-xs rounded-lg"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-block rounded-lg bg-white/70 px-2 py-1 text-xs font-medium text-brand-dark underline"
    >
      📎 Gönderilen dosyayı aç
    </a>
  );
}

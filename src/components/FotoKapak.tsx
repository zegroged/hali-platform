import { Logo } from "@/components/icons";

// KAPAK GÖRSELİ (2026-08-03)
//
// SORUN (ölçüldü, tahmin değil): canlıdaki işletme fotoğraflarının gerçek
// ölçüleri 165×220 ile 294×220 arasında ve oranları birbirini tutmuyor —
// bazısı YATAY (1.34), bazısı DİKEY (0.75). Kart kapağı ise sabit 16/10
// (1.60) ve `object-cover` kullanıyordu. Sonuç:
//   • dikey fotoğrafın yalnız orta şeridi görünüyor (kafa/tabela kesiliyor),
//   • 165 px genişliğindeki görsel 343 px'lik kutuya (telefonda 2-3x piksel
//     yoğunluğuyla ~1000 px) gerilip bulanıklaşıyordu.
// Yani "çirkin görüntü"nün kaynağı düzen değil, KAYNAK GÖRSELİN KENDİSİ.
//
// ÇÖZÜM: görsel artık KIRPILMIYOR (`object-contain`) — tamamı görünür. Arkaya
// aynı görselin büyütülüp bulanıklaştırılmış kopyası konuyor; boşluk beyaz
// bir bant yerine fotoğrafın renklerinden bir zemine dönüşüyor. Bu yaygın bir
// yöntem (müzik/video uygulamalarındaki kapak dolgusu) ve düşük çözünürlüğü de
// affeder: gözün odaklandığı yer keskin kalır, kenarlar yumuşar.
//
// ⚠️ ASIL ÇÖZÜM YİNE DE İYİ FOTOĞRAF: 165 px'lik bir kareyi hiçbir düzen
// kurtarmaz. Halıcıya telefonuyla yatay, aydınlık bir dükkân fotoğrafı
// çektirmek kartı bir anda değiştirir.
export default function FotoKapak({
  url,
  alt,
  oran = "aspect-[16/10]",
  ikonBoyut = 44,
  className = "",
}: {
  url: string | null;
  alt: string;
  /** Tailwind oran sınıfı — listeler arası tutarlılık için varsayılan 16/10. */
  oran?: string;
  ikonBoyut?: number;
  className?: string;
}) {
  return (
    <div className={`relative ${oran} overflow-hidden bg-slate-100 ${className}`}>
      {url ? (
        <>
          {/* Bulanık dolgu: aynı görselin büyütülmüş kopyası. Aynı URL olduğu
              için tarayıcı ikinci kez indirmez. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-125 object-cover blur-lg saturate-[1.35] brightness-95"
          />
          {/* Gerçek görsel: kırpılmadan, ortalanmış.
              PARLAKLIK/KONTRAST NORMALİZASYONU (2026-08-06): halıcıların
              gönderdiği fotoğraflar aynı listede yan yana çok farklı pozlarda
              duruyor — biri flaşla patlamış, öteki loş dükkânda çekilmiş. Kart
              ızgarası bu yüzden "derme çatma" görünüyordu. Hafif bir kontrast
              artışı + doygunluk, ucu kaçmış pozları birbirine YAKLAŞTIRIR
              (düzeltmez — kaynak neyse odur, bkz. yukarıdaki uyarı).
              Değerler bilerek küçük: fotoğrafı sahtelemeden, ızgarayı tek
              elden çıkmış gibi göstermeye yetecek kadar. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="relative h-full w-full object-contain contrast-[1.06] saturate-[1.08] transition duration-300 group-hover:scale-[1.03]"
          />
          {/* Alt kenara çok hafif koyu geçiş: farklı parlaklıktaki kapakların
              altındaki başlık şeridi aynı ağırlıkta okunsun. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-900/10 to-transparent"
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center bg-brand-light opacity-60">
          <Logo size={ikonBoyut} />
        </div>
      )}
    </div>
  );
}

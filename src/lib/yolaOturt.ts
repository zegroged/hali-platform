// YOLLARA OTURTMA (map matching) — KENDİ OSRM'İMİZ (2026-08-07 gecesi).
//
// NEDEN: işletme sahibi rota ekranına bakıp *"burada şoförün nereye gittiği
// belli mi ki?"* dedi. Ölçüldü, haklıydı: gerçek izde noktalar arası **medyan
// 145 m** (web şoför ekranı arka planda kısılıyordu). O aralıkta çizgi sokağı
// takip edemez — iki noktayı kuş uçuşu birleştirir, bina/park demeden keser.
//
// İKİ AYRI KAZANÇ, KARIŞTIRMA:
//  1. 1.1.9 ile uygulama 5 sn'de bir örnekleyip 25 m'de bir gönderiyor →
//     noktalar sıklaşıyor, çizgi kendiliğinden düzeliyor.
//  2. BU DOSYA: elde ne varsa onu GERÇEK YOLLARA oturtur.
//
// ⚠️ NEDEN KENDİ OSRM'İMİZ (Google Roads değil — kullanıcı kararı):
// aylık maliyet ₺0 ve aynı yığın ileride harita faturasını da sıfırlayacak
// (DEVIR §5-D0). Sunucuda `osrm-routed` Türkiye verisiyle çalışıyor.
//
// 🔴 ÜÇ GÜVENLİK KURALI — "yalanı inandırıcı yapma" (DEVIR U9):
//  1. YALNIZ PARÇA İÇİNDE oturtulur. Veri boşluğunun (kopukluk) üzerinden
//     ASLA yol uydurulmaz — orada zaten çizgi çizmiyoruz.
//  2. Oturtulan yolun uzunluğu ham izden çok saparsa (%40) SONUÇ ATILIR.
//     OSRM emin olmadığında uzak bir yolu seçebiliyor; öyle bir rota
//     "şoför oradan gitti" diye okunur ve yalan olur.
//  3. OSRM erişilemezse/yavaşsa ham iz çizilir. Harita hiçbir koşulda boş
//     kalmaz.

const OSRM = process.env.OSRM_URL ?? "http://osrm:5000";
/** Bir istekte gönderilecek en fazla nokta (osrm-routed --max-matching-size). */
const MAX_NOKTA = 500;
/** GPS belirsizlik yarıçapı (m) — şehir içi telefon fixi için makul. */
const YARICAP = 30;
/** Oturtulan yol ham izden bu orandan fazla saparsa güvenme. */
const SAPMA_TAVANI = 0.4;

export type Nokta = [number, number]; // [lat, lng]

function metre(a: Nokta, b: Nokta): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function uzunluk(p: Nokta[]): number {
  let t = 0;
  for (let i = 1; i < p.length; i++) t += metre(p[i - 1], p[i]);
  return t;
}

/**
 * Tek bir parçayı yollara oturt. Başarısızlıkta parçanın KENDİSİ döner —
 * çağıran taraf hiçbir zaman boş liste görmez.
 */
async function parcayiOturt(parca: Nokta[]): Promise<Nokta[]> {
  if (parca.length < 2 || parca.length > MAX_NOKTA) return parca;
  const koordinat = parca.map(([la, ln]) => `${ln},${la}`).join(";");
  const yaricap = parca.map(() => YARICAP).join(";");
  const url =
    `${OSRM}/match/v1/driving/${koordinat}` +
    `?geometries=geojson&overview=full&gaps=ignore&tidy=true&radiuses=${yaricap}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000), // panel beklemesin
    });
    if (!res.ok) return parca;
    const d = (await res.json()) as {
      code?: string;
      matchings?: { confidence?: number; geometry?: { coordinates?: [number, number][] } }[];
    };
    if (d.code !== "Ok" || !d.matchings?.length) return parca;

    // Birden çok eşleşme dönebilir (OSRM izi bölebilir); sırayla birleştir.
    const cikti: Nokta[] = [];
    for (const m of d.matchings) {
      for (const [ln, la] of m.geometry?.coordinates ?? []) cikti.push([la, ln]);
    }
    if (cikti.length < 2) return parca;

    // KURAL 2: uzunluk kontrolü — uydurma rotayı at.
    const ham = uzunluk(parca);
    const yeni = uzunluk(cikti);
    if (ham > 0 && Math.abs(yeni - ham) / ham > SAPMA_TAVANI) {
      console.warn(
        `[yola-oturt] sapma çok büyük, ham iz kullanıldı (ham ${Math.round(ham)} m, oturtulmuş ${Math.round(yeni)} m)`,
      );
      return parca;
    }
    return cikti;
  } catch (e) {
    console.error("[yola-oturt] OSRM'e ulaşılamadı, ham iz çizilecek:", e);
    return parca;
  }
}

/**
 * Parçaların TAMAMINI yollara oturt. Sıra ve kopukluklar korunur.
 * OSRM kapalıysa girdi olduğu gibi döner (özellik kapalı gibi davranır).
 */
export async function yollaraOturt(parcalar: Nokta[][]): Promise<Nokta[][]> {
  if (!parcalar.length) return parcalar;
  // Paralel: parça sayısı zaten az (gerçek günde 6), OSRM yereldir.
  return Promise.all(parcalar.map((p) => parcayiOturt(p)));
}

/** Özellik açık mı — OSRM adresi tanımlıysa denenir. */
export const yolaOturtmaAcik = Boolean(process.env.OSRM_URL ?? true);

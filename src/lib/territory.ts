import { prisma } from "@/lib/prisma";
import { CITIES, districtsOfCity, normalizeCityName, normalizeDistrictName } from "@/lib/cities";

// KOMİSYONCU BÖLGE HARİTASI (2026-07-28).
//
// AMAÇ: "bir komisyoncunun bölgesine diğeri dadanmasın" — ama ENGELLEYEREK
// değil, GÖRÜNÜR KILARAK. Kullanıcı kararı: bir ilçeye 10 komisyoncu atanmış
// olsa da tek işletme kayıt olmamış olabilir; atıl bir atama yüzünden gerçekten
// satış yapacak kişiyi engellemek bize zarar verir. O yüzden atama sırasında
// UYARI çıkar, karar insanın.
//
// SAYIMLAR:
// - komisyoncu: o ilçeye atanmış AKTİF komisyoncu sayısı (pasif/dondurulmuş
//   hariç — "burada kimse çalışmıyor" bilgisi yanlış çıkmasın).
// - işletme: o ilçede KAYITLI işletme sayısı. Kasten `isVisible` filtresi YOK:
//   komisyoncu için ödemesi gecikmiş ya da profili yarım işletme de "kayıt"tır,
//   satış potansiyeli değil GEÇMİŞ EMEK göstergesidir.

export type IlceSatiri = {
  city: string;
  district: string;
  komisyoncu: number;
  isletme: number;
};

export type IlOzeti = {
  city: string;
  slug: string;
  komisyoncu: number; // ildeki farklı komisyoncu sayısı
  isletme: number;
  ilceSayisi: number;
  dolulIlce: number; // en az 1 komisyoncusu olan ilçe
};

export type Harita = {
  iller: IlOzeti[];
  ilceler: Map<string, IlceSatiri>; // anahtar: "İl|İlçe"
  /** İl/ilçesi tanınmayan işletme sayısı — sayımlara giremeyenler. */
  konumsuzIsletme: number;
};

/**
 * Bölge haritası.
 *
 * @param sadeceIl verilirse SORGU DA VERİ DE o ille sınırlanır.
 *   ⚠️ BU PARAMETRE BİR GÜVENLİK SINIRIDIR, süsleme değil (2026-07-28 denetim
 *   bulgusu). Alt komisyoncuya ülke geneli veri GÖNDERİLMEMELİ; önce hepsini
 *   çekip ekranda filtrelemek yetmez — `BolgeHaritasi` bir istemci bileşeni,
 *   props'ları RSC yükünde tarayıcıya iniyor ve sayfa kaynağından okunabiliyor.
 *   Alt komisyoncu böylece ülkenin tamamının komisyoncu/işletme dağılımını
 *   (rekabet bilgisi) görebiliyordu.
 */
export async function bolgeHaritasi(sadeceIl?: string): Promise<Harita> {
  const ilKisit = sadeceIl ? normalizeCityName(sadeceIl) : null;

  const [terr, biz, konumsuz] = await Promise.all([
    prisma.agentTerritory.findMany({
      where: {
        agent: { active: true, suspendedByAdmin: false },
        ...(ilKisit ? { city: ilKisit } : {}),
      },
      select: { city: true, district: true, agentId: true },
    }),
    prisma.cleanerBusiness.groupBy({
      by: ["city", "district"],
      where: ilKisit ? { city: ilKisit } : undefined,
      _count: true,
    }),
    // Sayımlara giremeyen kayıtlar (il/ilçesi boş — bkz. DEVIR 4.28). Sessizce
    // yutmak yerine sayısını gösteriyoruz ki "işletme sayısı eksik" sanılmasın.
    ilKisit
      ? Promise.resolve(0)
      : prisma.cleanerBusiness.count({ where: { OR: [{ city: "" }, { district: "" }] } }),
  ]);

  const ilceler = new Map<string, IlceSatiri>();
  const anahtar = (c: string, d: string) => `${c}|${d}`;
  const al = (c: string, d: string) => {
    const k = anahtar(c, d);
    let r = ilceler.get(k);
    if (!r) {
      r = { city: c, district: d, komisyoncu: 0, isletme: 0 };
      ilceler.set(k, r);
    }
    return r;
  };

  // TEK GEÇİŞ (2026-07-28 denetim): eskiden il başına tüm bölge kayıtları
  // yeniden taranıyordu (81 × kayıt sayısı, üstelik her turda normalizeCityName
  // çağrısıyla). Artık bir kez dolaşıp il→komisyoncu kümesi çıkarıyoruz.
  const ilBazliAjanlar = new Map<string, Set<string>>();
  const gorulen = new Set<string>(); // aynı kişi aynı ilçede iki kez sayılmasın
  for (const t of terr) {
    const c = normalizeCityName(t.city);
    if (!c) continue;
    const d = normalizeDistrictName(c, t.district);
    if (!d) continue;
    let küme = ilBazliAjanlar.get(c);
    if (!küme) {
      küme = new Set<string>();
      ilBazliAjanlar.set(c, küme);
    }
    küme.add(t.agentId);
    const tekil = `${t.agentId}|${c}|${d}`;
    if (gorulen.has(tekil)) continue;
    gorulen.add(tekil);
    al(c, d).komisyoncu++;
  }

  let konumsuzIsletme = typeof konumsuz === "number" ? konumsuz : 0;
  for (const b of biz) {
    const c = normalizeCityName(b.city ?? "");
    const d = c ? normalizeDistrictName(c, b.district ?? "") : null;
    if (!c || !d) {
      // İl/ilçesi listede tanınmayan kayıt — üstteki count'a girmemişse ekle.
      if (!ilKisit && b.city && b.district) konumsuzIsletme += b._count;
      continue;
    }
    al(c, d).isletme += b._count;
  }

  const hedefIller = ilKisit ? CITIES.filter((c) => c.name === ilKisit) : CITIES;
  const iller: IlOzeti[] = hedefIller.map((c) => {
    const ilceAdlari = districtsOfCity(c.name);
    let isletme = 0;
    let dolulIlce = 0;
    for (const d of ilceAdlari) {
      const r = ilceler.get(anahtar(c.name, d));
      if (!r) continue;
      isletme += r.isletme;
      if (r.komisyoncu > 0) dolulIlce++;
    }
    return {
      city: c.name,
      slug: c.slug,
      // Aynı kişi 3 ilçe aldıysa il sayacında 1 görünür.
      komisyoncu: ilBazliAjanlar.get(c.name)?.size ?? 0,
      isletme,
      ilceSayisi: ilceAdlari.length,
      dolulIlce,
    };
  });

  return { iller, ilceler, konumsuzIsletme };
}

/** Bir ilçede hâlihazırda çalışan komisyoncular (kim nerede — admin görünümü). */
export async function ilcedekiKomisyoncular(city: string, district: string) {
  const c = normalizeCityName(city);
  if (!c) return [];
  const d = normalizeDistrictName(c, district);
  if (!d) return [];
  const rows = await prisma.agentTerritory.findMany({
    where: {
      city: c,
      district: d,
      agent: { active: true, suspendedByAdmin: false },
    },
    select: { agent: { select: { id: true, user: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ id: r.agent.id, name: r.agent.user.name }));
}

export type BolgeSonuc =
  | { ok: true; city: string; districts: string[] }
  | { ok: false; hata: string }
  | { ok: true; city: null; districts: [] }; // hiç bölge girilmedi (geçerli)

/**
 * Formdan il + ilçe listesi oku.
 *
 * ⚠️ SESSİZ YUTMA YOK (2026-07-28 denetim bulgusu): eskiden `null` dönüyordu ve
 * çağıran taraf bunu "bölge girilmemiş" sanıp kaydı bölgesiz açıyor, üstelik
 * "oluşturuldu" diyordu. İl seçip ilçe seçmeyi unutan kullanıcı hesabı bölgesiz
 * açtığını hiç fark etmiyordu. Artık ayırt ediyoruz:
 *   - il de ilçe de boş  → {ok:true, city:null}  (bilinçli olarak bölgesiz)
 *   - il var, ilçe yok   → {ok:false, hata}      (çağıran hata göstermeli)
 */
export function bolgeOku(cityRaw: string, districtsRaw: string[]): BolgeSonuc {
  const ham = String(cityRaw ?? "").trim();
  const secilen = districtsRaw.map((d) => String(d ?? "").trim()).filter(Boolean);
  if (!ham && secilen.length === 0) return { ok: true, city: null, districts: [] };

  const city = normalizeCityName(ham);
  if (!city) return { ok: false, hata: "Bölge için geçerli bir il seçin." };
  const districts = Array.from(
    new Set(
      secilen
        .map((d) => normalizeDistrictName(city, d))
        .filter((d): d is string => Boolean(d)),
    ),
  );
  if (districts.length === 0)
    return {
      ok: false,
      hata: `${city} seçtiniz ama ilçe seçmediniz — en az bir ilçe seçin ya da il seçimini boşaltın.`,
    };
  return { ok: true, city, districts };
}

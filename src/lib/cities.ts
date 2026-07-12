import { DISTRICTS_BY_CITY } from "@/lib/districts";

// 81 il — şehir SEO sayfalarının tek kaynağı (/hali-yikama/[sehir], /sehirler,
// sitemap ve ana sayfa şehir kısayolları aynı listeyi kullanır).
export type City = { name: string; slug: string };

export const CITIES: City[] = [
  { name: "Adana", slug: "adana" },
  { name: "Adıyaman", slug: "adiyaman" },
  { name: "Afyonkarahisar", slug: "afyonkarahisar" },
  { name: "Ağrı", slug: "agri" },
  { name: "Aksaray", slug: "aksaray" },
  { name: "Amasya", slug: "amasya" },
  { name: "Ankara", slug: "ankara" },
  { name: "Antalya", slug: "antalya" },
  { name: "Ardahan", slug: "ardahan" },
  { name: "Artvin", slug: "artvin" },
  { name: "Aydın", slug: "aydin" },
  { name: "Balıkesir", slug: "balikesir" },
  { name: "Bartın", slug: "bartin" },
  { name: "Batman", slug: "batman" },
  { name: "Bayburt", slug: "bayburt" },
  { name: "Bilecik", slug: "bilecik" },
  { name: "Bingöl", slug: "bingol" },
  { name: "Bitlis", slug: "bitlis" },
  { name: "Bolu", slug: "bolu" },
  { name: "Burdur", slug: "burdur" },
  { name: "Bursa", slug: "bursa" },
  { name: "Çanakkale", slug: "canakkale" },
  { name: "Çankırı", slug: "cankiri" },
  { name: "Çorum", slug: "corum" },
  { name: "Denizli", slug: "denizli" },
  { name: "Diyarbakır", slug: "diyarbakir" },
  { name: "Düzce", slug: "duzce" },
  { name: "Edirne", slug: "edirne" },
  { name: "Elazığ", slug: "elazig" },
  { name: "Erzincan", slug: "erzincan" },
  { name: "Erzurum", slug: "erzurum" },
  { name: "Eskişehir", slug: "eskisehir" },
  { name: "Gaziantep", slug: "gaziantep" },
  { name: "Giresun", slug: "giresun" },
  { name: "Gümüşhane", slug: "gumushane" },
  { name: "Hakkari", slug: "hakkari" },
  { name: "Hatay", slug: "hatay" },
  { name: "Iğdır", slug: "igdir" },
  { name: "Isparta", slug: "isparta" },
  { name: "İstanbul", slug: "istanbul" },
  { name: "İzmir", slug: "izmir" },
  { name: "Kahramanmaraş", slug: "kahramanmaras" },
  { name: "Karabük", slug: "karabuk" },
  { name: "Karaman", slug: "karaman" },
  { name: "Kars", slug: "kars" },
  { name: "Kastamonu", slug: "kastamonu" },
  { name: "Kayseri", slug: "kayseri" },
  { name: "Kırıkkale", slug: "kirikkale" },
  { name: "Kırklareli", slug: "kirklareli" },
  { name: "Kırşehir", slug: "kirsehir" },
  { name: "Kilis", slug: "kilis" },
  { name: "Kocaeli", slug: "kocaeli" },
  { name: "Konya", slug: "konya" },
  { name: "Kütahya", slug: "kutahya" },
  { name: "Malatya", slug: "malatya" },
  { name: "Manisa", slug: "manisa" },
  { name: "Mardin", slug: "mardin" },
  { name: "Mersin", slug: "mersin" },
  { name: "Muğla", slug: "mugla" },
  { name: "Muş", slug: "mus" },
  { name: "Nevşehir", slug: "nevsehir" },
  { name: "Niğde", slug: "nigde" },
  { name: "Ordu", slug: "ordu" },
  { name: "Osmaniye", slug: "osmaniye" },
  { name: "Rize", slug: "rize" },
  { name: "Sakarya", slug: "sakarya" },
  { name: "Samsun", slug: "samsun" },
  { name: "Siirt", slug: "siirt" },
  { name: "Sinop", slug: "sinop" },
  { name: "Sivas", slug: "sivas" },
  { name: "Şanlıurfa", slug: "sanliurfa" },
  { name: "Şırnak", slug: "sirnak" },
  { name: "Tekirdağ", slug: "tekirdag" },
  { name: "Tokat", slug: "tokat" },
  { name: "Trabzon", slug: "trabzon" },
  { name: "Tunceli", slug: "tunceli" },
  { name: "Uşak", slug: "usak" },
  { name: "Van", slug: "van" },
  { name: "Yalova", slug: "yalova" },
  { name: "Yozgat", slug: "yozgat" },
  { name: "Zonguldak", slug: "zonguldak" },
];

// Ana sayfa/footer kısayolları — en kalabalık iller (tümü /sehirler'de).
export const FEATURED_CITY_SLUGS = [
  "istanbul",
  "ankara",
  "izmir",
  "bursa",
  "antalya",
  "adana",
  "konya",
  "gaziantep",
  "kocaeli",
  "mersin",
  "diyarbakir",
  "samsun",
];

// 7 coğrafi bölge — şehir sayfalarında şehre özgü içerik + bölge-içi iç link
// (81 sayfanın hepsine 80'er link koymak yerine ilgili komşular).
export type Region =
  | "Marmara"
  | "Ege"
  | "Akdeniz"
  | "İç Anadolu"
  | "Karadeniz"
  | "Doğu Anadolu"
  | "Güneydoğu Anadolu";

const REGION_CITIES: Record<Region, string[]> = {
  Marmara: ["istanbul", "kocaeli", "yalova", "bursa", "sakarya", "bilecik", "balikesir", "canakkale", "tekirdag", "kirklareli", "edirne"],
  Ege: ["izmir", "aydin", "mugla", "manisa", "denizli", "usak", "kutahya", "afyonkarahisar"],
  Akdeniz: ["antalya", "isparta", "burdur", "mersin", "adana", "hatay", "kahramanmaras", "osmaniye"],
  "İç Anadolu": ["ankara", "konya", "eskisehir", "cankiri", "kirikkale", "kirsehir", "nevsehir", "nigde", "aksaray", "kayseri", "sivas", "yozgat", "karaman"],
  Karadeniz: ["bolu", "duzce", "zonguldak", "bartin", "karabuk", "kastamonu", "sinop", "samsun", "amasya", "corum", "tokat", "ordu", "giresun", "trabzon", "rize", "artvin", "gumushane", "bayburt"],
  "Doğu Anadolu": ["erzurum", "erzincan", "kars", "agri", "igdir", "ardahan", "van", "mus", "bitlis", "hakkari", "bingol", "tunceli", "elazig", "malatya"],
  "Güneydoğu Anadolu": ["gaziantep", "kilis", "sanliurfa", "adiyaman", "diyarbakir", "mardin", "batman", "siirt", "sirnak"],
};

export function regionOfCity(citySlug: string): Region | null {
  for (const [region, slugs] of Object.entries(REGION_CITIES)) {
    if (slugs.includes(citySlug)) return region as Region;
  }
  return null;
}

/** Aynı bölgedeki diğer iller (kendisi hariç) — şehir sayfası iç linkleri. */
export function regionMates(citySlug: string): City[] {
  const region = regionOfCity(citySlug);
  if (!region) return [];
  return REGION_CITIES[region]
    .filter((s) => s !== citySlug)
    .map((s) => cityBySlug(s)!)
    .filter(Boolean);
}

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function featuredCities(): City[] {
  return FEATURED_CITY_SLUGS.map((s) => cityBySlug(s)!).filter(Boolean);
}

const FOLD_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};

function foldTr(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (ch) => FOLD_MAP[ch] ?? ch);
}

/**
 * Serbest/şüpheli il girdisini kanonik il adına çevirir ("istanbul",
 * "ISTANBUL", " İstanbul " → "İstanbul"). Listede yoksa null — il/ilçe
 * alanları yalnız 81 il listesinden kabul edilir.
 */
export function normalizeCityName(input: string): string | null {
  const folded = foldTr(input.trim());
  if (!folded) return null;
  const hit = CITIES.find((c) => c.slug === folded || foldTr(c.name) === folded);
  return hit ? hit.name : null;
}

/** İlin resmî ilçe listesi (kanonik il adıyla). Bilinmeyen il → boş liste. */
export function districtsOfCity(cityName: string): readonly string[] {
  const canonical = normalizeCityName(cityName);
  if (!canonical) return [];
  const slug = CITIES.find((c) => c.name === canonical)!.slug;
  return DISTRICTS_BY_CITY[slug] ?? [];
}

/** İlçe, verilen ilin resmî listesinde mi? Kanonik ilçe adını döndürür, yoksa null. */
export function normalizeDistrictName(
  cityName: string,
  district: string,
): string | null {
  const folded = foldTr(district.trim());
  if (!folded) return null;
  const hit = districtsOfCity(cityName).find((d) => foldTr(d) === folded);
  return hit ?? null;
}

/**
 * Arama kutusu metnini il/ilçeye çözer — "kars" → Kars ili, "kadıköy" →
 * İstanbul/Kadıköy, "konya selçuklu" → il+ilçe. Eşleşme yoksa null (arama
 * geocode'a düşer). Birden çok ilde geçen ilçe adında (örn. "Merkez") il
 * belirsizdir → yalnız ilçe adı döner (çapraz-il ilçe filtresi).
 */
export function resolveSearchLocation(
  text: string,
): { city?: string; district?: string } | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return null;
  const asCity = normalizeCityName(t);
  if (asCity) return { city: asCity };
  // İki parçalı: "il ilçe" veya "ilçe il"
  const tokens = t.split(" ");
  if (tokens.length >= 2) {
    for (let i = 1; i < tokens.length; i++) {
      const a = tokens.slice(0, i).join(" ");
      const b = tokens.slice(i).join(" ");
      const cityA = normalizeCityName(a);
      if (cityA) {
        const d = normalizeDistrictName(cityA, b);
        if (d) return { city: cityA, district: d };
      }
      const cityB = normalizeCityName(b);
      if (cityB) {
        const d = normalizeDistrictName(cityB, a);
        if (d) return { city: cityB, district: d };
      }
    }
  }
  // Tek başına ilçe adı — hangi il(ler)de geçiyor?
  const matches: { city: string; district: string }[] = [];
  for (const c of CITIES) {
    const d = normalizeDistrictName(c.name, t);
    if (d) matches.push({ city: c.name, district: d });
    if (matches.length > 1) break; // 2+ bulunca belirsiz; devam etmeye gerek yok
  }
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { district: matches[0].district };
  return null;
}

/** İlçe SEO sayfası URL parçası: "Eyüpsultan" → "eyupsultan", "Merkez" → "merkez". */
export function districtSlug(district: string): string {
  return foldTr(district).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** İlçe slug'ından kanonik ilçe adı (il slug'ı bağlamında). Yoksa undefined. */
export function districtBySlug(
  citySlug: string,
  dSlug: string,
): string | undefined {
  return (DISTRICTS_BY_CITY[citySlug] ?? []).find(
    (d) => districtSlug(d) === dSlug,
  );
}

const BACK_VOWELS = new Set(["a", "ı", "o", "u", "A", "I", "O", "U"]);
const FRONT_VOWELS = new Set(["e", "i", "ö", "ü", "E", "İ", "Ö", "Ü"]);
const HARD_CONSONANTS = new Set(["f", "s", "t", "k", "ç", "ş", "h", "p"]);

/**
 * Türkçe bulunma hâli eki: "İstanbul'da", "İzmir'de", "Muş'ta", "Kilis'te".
 * Büyük ünlü uyumu (son ünlü) + ünsüz sertleşmesi (fıstıkçı şahap) uygulanır.
 */
export function locative(name: string): string {
  let vowel = "a"; // varsayılan (ünlüsüz ad pratikte yok)
  for (let i = name.length - 1; i >= 0; i--) {
    const ch = name[i];
    if (BACK_VOWELS.has(ch)) {
      vowel = "a";
      break;
    }
    if (FRONT_VOWELS.has(ch)) {
      vowel = "e";
      break;
    }
  }
  const last = name[name.length - 1].toLocaleLowerCase("tr-TR");
  const cons = HARD_CONSONANTS.has(last) ? "t" : "d";
  return `${name}'${cons}${vowel}`;
}

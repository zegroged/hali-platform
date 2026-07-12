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

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function featuredCities(): City[] {
  return FEATURED_CITY_SLUGS.map((s) => cityBySlug(s)!).filter(Boolean);
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

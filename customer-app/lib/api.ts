import { authHeader, saveSession } from "./auth";

// Backend adresi ORTAMDAN gelir (sabit IP gömme — mağaza derlemesinde kırılır).
// Üretim derlemesi EAS profilinden `EXPO_PUBLIC_API_BASE=https://...` alır
// (eas.json); dev için kabuk: EXPO_PUBLIC_API_BASE=http://192.168.0.11:3000
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "https://enyakinhaliyikamaservisi.com";

/** Sunucunun Türkçe hata mesajını taşıyan hata — UI olduğu gibi gösterir. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(res: Response, fallback: string): Promise<ApiError> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return new ApiError(data?.error ?? fallback, res.status);
}

export type Business = {
  id: string;
  name: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  ratingAvg: number;
  ratingCount: number;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  minPrice: number | null;
  isNew: boolean;
  isOpenNow: boolean;
  isPaused: boolean; // tatil modu — "sipariş almıyor" rozeti
  distanceKm: number | null;
  coverUrl: string | null;
  badges: string[];
};

export type Pricing = {
  label: string;
  unit: string;
  price: number;
  isAddon: boolean;
};
export type Review = {
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
};
export type Photo = {
  url: string;
  isBefore: boolean;
  isAfter: boolean;
  caption: string | null;
};
export type BusinessDetail = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  district: string;
  phone: string;
  // Ek numaralar — web İKİZİ: profil "Sabit Hat" + "GSM & WhatsApp" gruplu gösterir.
  gsmPhone2?: string | null;
  landlinePhone?: string | null;
  // Yalnız 10 haneli VKN (tüzel kişi); TCKN sunucuda null'lanır (sızmasın).
  taxNumber?: string | null;
  workingHours: Record<string, { open: string; close: string } | null> | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  ratingAvg: number;
  ratingCount: number;
  badges: string[];
  pricing: Pricing[];
  photos: Photo[];
  reviews: Review[];
  // Tatil modu: doluysa ve gelecekteyse işletme yeni sipariş almıyor.
  pausedUntil?: string | null;
  googleProfileUrl?: string | null;
};

export type Tracking = {
  status: string;
  // Kesin-fiyat onayı ve iptal yalnız UZUN takip token'ıyla (veya giriş yapmış
  // sahip) yapılabilir; kısa kodla açılınca false → o butonlar gizlenir (web
  // ile aynı kapı). Sunucu /api/orders/[token] yanıtında döndürür.
  fullAccess?: boolean;
  rejectReason: string | null;
  createdAt: string;
  customerName: string;
  business: { name: string; phone: string };
  events: { status: string; note: string | null; at: string }[];
  driver: { name: string; lat: number; lng: number } | null;
  priceTotal: number | null;
  paymentMethod: string;
  // md.15/1-h: işletmenin bildirdiği kesin fiyat + müşterinin onay anı.
  // quotedPrice dolu ve priceApprovedAt boşsa müşteriden ONAY beklenir.
  quotedPrice: number | null;
  priceApprovedAt: string | null;
  estimatedDays: number | null;
  photos: { id: string; url: string }[];
  // Teslim sonrası değerlendirme: yorumlandıysa yıldızı, yoksa (üye+sahipse)
  // yorum formunu göster (web TrackingClient ile aynı).
  review: { rating: number } | null;
  viewerIsCustomer?: boolean;
  // SLA/kurtarma: 24 saattir yanıtsız mı + aynı şehirden alternatif halıcılar
  waitingLong?: boolean;
  alternatives?: {
    id: string;
    name: string;
    district: string;
    ratingAvg: number;
    ratingCount: number;
  }[];
};

export async function getBusinesses(opts?: {
  coords?: { lat: number; lng: number };
  /** Serbest metin: şehir/ilçe/işletme adı araması. */
  query?: string;
}): Promise<Business[]> {
  const p = new URLSearchParams();
  // Koordinat ~110 m'ye yuvarlanır: sıralama için fazlası gereksiz, kesin
  // konum URL/erişim loglarında kalıcılaşmasın (gizlilik beyanıyla tutarlı).
  if (opts?.coords) {
    p.set("lat", opts.coords.lat.toFixed(3));
    p.set("lng", opts.coords.lng.toFixed(3));
  }
  if (opts?.query?.trim()) p.set("q", opts.query.trim());
  const qs = p.toString();
  const res = await fetch(`${API_BASE}/api/businesses${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new ApiError("Liste alınamadı.", res.status);
  return (await res.json()).businesses ?? [];
}

export async function getBusiness(id: string): Promise<BusinessDetail | null> {
  const res = await fetch(`${API_BASE}/api/businesses/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export type OrderBody = {
  businessId: string;
  customerName: string;
  customerPhone: string;
  /** Opsiyonel — girilirse takip linki e-postayla da gider. */
  customerEmail?: string;
  pickupAddress: string;
  // Konum: şoför navigasyonu + hizmet-bölgesi kontrolü için (native GPS en
  // doğru kaynak). Opsiyonel — kullanıcı izin vermezse sipariş yine oluşur.
  pickupLat?: number;
  pickupLng?: number;
  approxM2?: number;
  note?: string;
  paymentMethod: "CASH" | "CARD";
  // Mesafeli Sözleşmeler Yön. md.7: ön bilgilendirme TEYİDİ — sunucu bunsuz
  // siparişi reddeder; UI onay kutusu işaretlenmeden göndermemeli.
  consent: true;
};

export async function createOrder(
  body: OrderBody,
): Promise<{ trackingToken: string; code: string | null }> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    // Giriş yapılmışsa Bearer gönder → sipariş customerId alır, sonradan
    // değerlendirilebilir. Misafirse başlık boş, sipariş yine oluşur.
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Sunucunun gerçek mesajı gösterilir (tatil modu, şoför yok, abonelik...)
    throw await readError(res, "Sipariş oluşturulamadı.");
  }
  return res.json();
}

/**
 * Takip verisi. null = sipariş GERÇEKTEN yok (404). Geçici hatalar (429/5xx)
 * ApiError fırlatır — polling'de mevcut görünüm korunmalı, "bulunamadı"
 * gösterilmemeli (rate limit/deploy anında ekran silinmesin).
 */
export async function getTracking(
  codeOrToken: string,
): Promise<Tracking | null> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}`,
    // Giriş varsa Bearer → sunucu viewerIsCustomer + sahip fullAccess'i döndürür
    // (kısa kodla bile sahip onay/iptal/yorum yapabilsin).
    { headers: { ...(await authHeader()) } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw await readError(res, "Takip bilgisi alınamadı.");
  return res.json();
}

/** md.15/1-h: kesin fiyata müşteri onayı — yıkama bu onayla başlar. */
export async function approvePrice(codeOrToken: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}/approve-price`,
    { method: "POST" },
  );
  if (!res.ok) throw await readError(res, "Onay gönderilemedi.");
}

// Sunucudaki CANCEL_REASONS ile birebir aynı tutulmalı.
export const CANCEL_REASONS = [
  "Vazgeçtim",
  "Fiyat beklentimi aştı",
  "Başka işletmeyle anlaştım",
  "Zamanlama uygun değil",
  "Diğer",
] as const;

/** Platform üzerinden iptal/cayma — yalnız halı alınmadan (CREATED/ACCEPTED). */
export async function cancelOrder(
  codeOrToken: string,
  reason: string,
  note?: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, note }),
    },
  );
  if (!res.ok) throw await readError(res, "İptal edilemedi.");
}

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : API_BASE + path;
}

// ————————————————————— Üyelik + Değerlendirme —————————————————————

/** E-posta + şifre ile giriş; başarıda token SecureStore'a yazılır. */
export async function customerLogin(
  email: string,
  password: string,
): Promise<{ name: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });
  if (!res.ok) throw await readError(res, "Giriş başarısız.");
  const d = (await res.json()) as {
    token?: string;
    name?: string;
    role?: string;
  };
  if (!d.token) throw new ApiError("Oturum açılamadı.", 500);
  await saveSession(d.token, d.name ?? "");
  return { name: d.name ?? "" };
}

/** Kayıt için e-postaya 6 haneli doğrulama kodu gönder. */
export async function requestRegisterCode(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/register/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await readError(res, "Kod gönderilemedi.");
}

/** Kayıt (kod doğrulaması ile); başarıda token SecureStore'a yazılır. */
export async function customerRegister(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  emailCode: string;
}): Promise<{ name: string }> {
  const res = await fetch(`${API_BASE}/api/auth/customer-register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await readError(res, "Kayıt tamamlanamadı.");
  const d = (await res.json()) as { token?: string; name?: string };
  if (!d.token) throw new ApiError("Oturum açılamadı.", 500);
  await saveSession(d.token, d.name ?? input.name);
  return { name: d.name ?? input.name };
}

/** Teslim edilen siparişe yıldız + yorum (yalnız giriş yapmış SAHİP müşteri). */
export async function submitReview(
  codeOrToken: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ rating, comment }),
    },
  );
  if (!res.ok) throw await readError(res, "Değerlendirme gönderilemedi.");
}

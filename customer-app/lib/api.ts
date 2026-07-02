// Backend adresi ORTAMDAN gelir (sabit IP gömme — mağaza derlemesinde kırılır).
// Üretim derlemesi için EAS profilinde `EXPO_PUBLIC_API_BASE=https://...` tanımla.
// Dev için yerel .env veya kabuk: EXPO_PUBLIC_API_BASE=http://192.168.0.11:3000
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://192.168.0.11:3000";

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
  workingHours: Record<string, { open: string; close: string } | null> | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  ratingAvg: number;
  ratingCount: number;
  badges: string[];
  pricing: Pricing[];
  photos: Photo[];
  reviews: Review[];
};

export type Tracking = {
  status: string;
  rejectReason: string | null;
  createdAt: string;
  customerName: string;
  business: { name: string; phone: string };
  events: { status: string; note: string | null; at: string }[];
  driver: { name: string; lat: number; lng: number } | null;
  priceTotal: number | null;
  paymentMethod: string;
};

export async function getBusinesses(coords?: {
  lat: number;
  lng: number;
}): Promise<Business[]> {
  const q = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
  const res = await fetch(`${API_BASE}/api/businesses${q}`);
  if (!res.ok) return [];
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
  pickupAddress: string;
  approxM2?: number;
  note?: string;
  paymentMethod: "CASH" | "CARD";
};

export async function createOrder(
  body: OrderBody,
): Promise<{ trackingToken: string; code: string | null }> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Sipariş oluşturulamadı");
  return res.json();
}

export async function getTracking(
  codeOrToken: string,
): Promise<Tracking | null> {
  const res = await fetch(
    `${API_BASE}/api/orders/${encodeURIComponent(codeOrToken)}`,
  );
  if (!res.ok) return null;
  return res.json();
}

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : API_BASE + path;
}

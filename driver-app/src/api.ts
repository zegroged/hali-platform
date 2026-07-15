import * as SecureStore from "expo-secure-store";

// Backend adresi ORTAMDAN gelir; eas.json production/preview profilleri
// EXPO_PUBLIC_API_BASE'i ayarlar. GÜVENLİ VARSAYILAN: üretim build'inde env
// unutulsa bile canlı HTTPS adresi kullanılır (eski LAN-IP fallback'i mağaza
// build'ini tamamen öldürüyordu — Android üretimde cleartext HTTP engellidir).
// Dev'de LAN IP: EXPO_PUBLIC_API_BASE=http://<PC-IP>:3000 (telefon aynı ağda).
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (__DEV__ ? "http://192.168.0.11:3000" : "https://enyakinhaliyikamaservisi.com");

const TOKEN_KEY = "hali_driver_token";

// Token şifreli saklama (Android Keystore / iOS Keychain) — düz AsyncStorage DEĞİL.
// Giriş kimliği: kullanıcı adı (telefonla giriş kaldırıldı — SMS doğrulaması yok).
export async function login(identifier: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error("Kullanıcı adı veya şifre hatalı.");
  const data = await res.json();
  if (data.role !== "DRIVER") throw new Error("Bu hesap şoför değil.");
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  return data as { name: string; token: string };
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function setShift(on: boolean) {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı");
  const res = await fetch(`${API_BASE}/api/driver/shift`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ on }),
  });
  // fetch HTTP hatasında throw ETMEZ — 401/500'de "Mesaidesin" gösterip
  // sunucunun kaydetmediği durum oluşuyordu (denetim bulgusu). Kontrol et.
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await logout();
      throw new Error("Oturum süresi doldu, tekrar giriş yap");
    }
    throw new Error("Mesai durumu kaydedilemedi, tekrar dene");
  }
}

// Arka plan görevinden çağrılır. Canlı takip için EN GÜNCEL konum önemlidir;
// geçici ağ hatasında tek sefer kısa retry — sonra bırak (sonraki ping günceller).
// NOT: Kalıcı offline kuyruk için sunucunun client-timestamp'li alımı gerekir
// (aksi halde eski konumlar yanlış zaman damgasıyla zaman çizelgesini bozar).
export async function postLocation(
  lat: number,
  lng: number,
): Promise<"ok" | "unauthorized" | "failed"> {
  const token = await getToken();
  if (!token) return "unauthorized";
  const body = JSON.stringify({ lat, lng });
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/api/driver/location`, {
        method: "POST",
        headers,
        body,
      });
      if (res.ok) return "ok";
      // Token süresi dolmuş/geçersiz: "Mesaidesin" görünüp konum hiç gitmemesin —
      // çağıran (tracking task) izlemeyi durdurup oturumu düşürür.
      if (res.status === 401 || res.status === 403) {
        await logout();
        return "unauthorized";
      }
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      console.warn("postLocation başarısız:", e);
    }
  }
  return "failed";
}

// ————————————————————— Sipariş yönetimi (native) —————————————————————

export type DriverOrder = {
  id: string;
  code: string | null;
  status: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  approxM2: number | null;
  note: string | null;
  quotedPrice: number | null;
  priceApprovedAt: string | null;
  paymentMethod: string;
  createdAt: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı");
  return { Authorization: `Bearer ${token}` };
}

async function jsonPost(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await logout();
      throw new Error("Oturum süresi doldu, tekrar giriş yap");
    }
    const d = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(d?.error ?? "İşlem yapılamadı, tekrar dene");
  }
}

export async function listOrders(): Promise<DriverOrder[]> {
  const res = await fetch(`${API_BASE}/api/driver/orders`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await logout();
      throw new Error("Oturum süresi doldu, tekrar giriş yap");
    }
    throw new Error("Siparişler alınamadı");
  }
  return ((await res.json()).orders ?? []) as DriverOrder[];
}

export const acceptOrder = (id: string) =>
  jsonPost(`/api/driver/orders/${id}/accept`);
export const rejectOrder = (id: string, reason: string, note?: string) =>
  jsonPost(`/api/driver/orders/${id}/reject`, { reason, note });
export const advanceOrder = (id: string, verbalConsent?: boolean) =>
  jsonPost(`/api/driver/orders/${id}/advance`, { verbalConsent });

// Fotoğraflı uçlar: multipart. photoUri = ImagePicker'dan gelen yerel dosya.
async function photoPost(
  path: string,
  photoUri: string,
  extra?: Record<string, string>,
): Promise<void> {
  const form = new FormData();
  // React Native FormData dosya biçimi (uri/name/type).
  form.append("photo", {
    uri: photoUri,
    name: "foto.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  if (extra) for (const k in extra) form.append(k, extra[k]);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: await authHeaders(), // Content-Type'ı FormData kendi set eder
    body: form,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await logout();
      throw new Error("Oturum süresi doldu, tekrar giriş yap");
    }
    const d = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(d?.error ?? "Gönderilemedi, tekrar dene");
  }
}

export const pickupOrder = (id: string, photoUri: string) =>
  photoPost(`/api/driver/orders/${id}/pickup`, photoUri);
export const deliverOrder = (id: string, price: number, photoUri: string) =>
  photoPost(`/api/driver/orders/${id}/deliver`, photoUri, {
    price: String(price),
  });

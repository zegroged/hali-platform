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
const ROLE_KEY = "hali_rol";

// TEK GİRİŞ EKRANI (2026-08-04, kullanıcı kararı: "aynı ekrandan girsinler,
// sitede olduğu gibi"). Eskiden burada `role !== "DRIVER"` ise giriş
// REDDEDİLİYORDU. Artık rol sunucudan ne gelirse gelsin kabul edilir; nereye
// düşeceğine App.tsx karar verir:
//   DRIVER            → native şoför ekranları (mesai, konum, foto)
//   CLEANER / AGENT / …→ uygulamanın içinde panelin kendisi (WebView)
// Böylece panelde çıkan her yeni özellik Play'e yeni sürüm göndermeden
// telefonda da görünür.
export type Rol =
  | "DRIVER"
  | "CLEANER"
  // Dükkân çalışanı (2026-08-06): sahiple AYNI paneli WebView'de açar, sunucu
  // tarafında sahibe özel sayfaları görmez. Uygulama tarafında ekstra iş yok —
  // yalnız rolün tanınması yeter, aksi hâlde şerit etiketi boş kalırdı.
  | "STAFF"
  | "AGENT"
  | "ADMIN"
  | "SUPPORT"
  | "ACCOUNTANT"
  | "CUSTOMER";

// Token şifreli saklama (Android Keystore / iOS Keychain) — düz AsyncStorage DEĞİL.
// Giriş kimliği: kullanıcı adı ya da e-posta (telefonla giriş kaldırıldı).
export async function login(identifier: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error("Kullanıcı adı veya şifre hatalı.");
  const data = await res.json();
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(ROLE_KEY, String(data.role ?? ""));
  return data as { name: string; token: string; role: Rol };
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/**
 * OTURUMU TAZELE (2026-08-06). Uygulama her açılışta çağırır:
 *  - jeton geçerliyse süresi sıfırlanır → aktif kullanan hiç çıkış yapmaz
 *  - geçersizse (süre doldu / şifre değişti / hesap engellendi) yerel kayıt
 *    temizlenir ve giriş ekranı gösterilir
 *
 * Dönen değer: oturum yaşıyorsa rol, ölmüşse null.
 * Ağ hatasında `undefined` döner — o durumda MEVCUT jetonla devam edilir
 * (uçakta/kapsama dışında açan şoför boş yere dışarı atılmasın).
 */
export async function oturumTazele(): Promise<Rol | null | undefined> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/yenile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) {
      await logout();
      return null;
    }
    if (!res.ok) return undefined; // sunucu hatası — mevcutla devam
    const d = (await res.json()) as { token?: string; role?: Rol };
    if (d.token) await SecureStore.setItemAsync(TOKEN_KEY, d.token);
    if (d.role) await SecureStore.setItemAsync(ROLE_KEY, String(d.role));
    return d.role ?? null;
  } catch {
    return undefined; // ağ yok — oturumu düşürme
  }
}

/** Kayıtlı rol — uygulama yeniden açıldığında hangi ekranın açılacağını belirler. */
export async function getRole(): Promise<Rol | null> {
  const r = await SecureStore.getItemAsync(ROLE_KEY);
  return (r as Rol) || null;
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ROLE_KEY);
}

/**
 * PANELİ UYGULAMANIN İÇİNDE AÇMAK İÇİN TEK KULLANIMLIK BAĞLANTI.
 *
 * Panel çerezle kimlik doğruluyor, elimizde ise Bearer jeton var. Sunucu bu
 * uçta 90 saniyelik, tek kullanımlık bir adres üretiyor; WebView oraya gidince
 * çerez kuruluyor ve rolün sayfasına yönlendiriliyor.
 * (Jetonu doğrudan adrese koymak onu sunucu log'larına ve Referer başlığına
 * düşürürdü — bkz. api/auth/mobil-baglanti.)
 */
export async function panelBaglantisi(): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("Oturum bulunamadı");
  const res = await fetch(`${API_BASE}/api/auth/mobil-baglanti`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      await logout();
      throw new Error("Oturum süresi doldu, tekrar giriş yap");
    }
    throw new Error("Panel açılamadı, tekrar dene");
  }
  const d = (await res.json()) as { url?: string };
  if (!d.url) throw new Error("Panel adresi alınamadı");
  return d.url;
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
  acc?: number,
): Promise<"ok" | "unauthorized" | "failed"> {
  const token = await getToken();
  if (!token) return "unauthorized";
  const body = JSON.stringify({ lat, lng, acc });
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

/**
 * HALI ALINDI. `carpetCount` = kaç halı alındı (2026-08-06).
 * Numaralar (1..N) bu andan itibaren var olur; öncesinde numara fotoğraftan
 * doğuyordu, yani fotoğrafı çekilmeyen halı sistemde hiç görünmüyordu.
 * Boş geçilebilir — sunucu opsiyonel kabul eder (eski davranışa düşer).
 */
export const pickupOrder = (
  id: string,
  photoUri: string,
  carpetCount?: number,
) =>
  photoPost(
    `/api/driver/orders/${id}/pickup`,
    photoUri,
    carpetCount != null ? { carpetCount: String(carpetCount) } : undefined,
  );
export const deliverOrder = (id: string, price: number, photoUri: string) =>
  photoPost(`/api/driver/orders/${id}/deliver`, photoUri, {
    price: String(price),
  });

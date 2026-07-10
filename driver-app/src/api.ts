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
  if (!token) return;
  await fetch(`${API_BASE}/api/driver/shift`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ on }),
  });
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

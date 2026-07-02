import * as SecureStore from "expo-secure-store";

// Backend adresi ORTAMDAN gelir (sabit IP gömme — mağaza derlemesinde kırılır).
// Üretim için EAS profilinde `EXPO_PUBLIC_API_BASE=https://...` tanımla.
// Dev: EXPO_PUBLIC_API_BASE=http://192.168.0.11:3000
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://192.168.0.11:3000";

const TOKEN_KEY = "hali_driver_token";

// Token şifreli saklama (Android Keystore / iOS Keychain) — düz AsyncStorage DEĞİL.
export async function login(phone: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  if (!res.ok) throw new Error("Telefon veya şifre hatalı.");
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
export async function postLocation(lat: number, lng: number) {
  const token = await getToken();
  if (!token) return;
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
      if (res.ok) return;
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      console.warn("postLocation başarısız:", e);
    }
  }
}

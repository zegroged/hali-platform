import * as SecureStore from "expo-secure-store";

// Oturum token'ı şifreli saklanır (Android Keystore / iOS Keychain) — düz
// depolama DEĞİL. Ad, arayüz için ayrıca tutulur (token çözülmeden gösterilsin).
const TOKEN_KEY = "hali_customer_token";
const NAME_KEY = "hali_customer_name";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredName(): Promise<string | null> {
  return SecureStore.getItemAsync(NAME_KEY);
}

export async function saveSession(token: string, name: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(NAME_KEY, name);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(NAME_KEY);
}

/** Bearer başlığı — token varsa; yoksa boş (misafir istekleri için). */
export async function authHeader(): Promise<Record<string, string>> {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

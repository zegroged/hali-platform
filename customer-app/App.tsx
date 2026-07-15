import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HomeScreen } from "./screens/HomeScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { OrderScreen } from "./screens/OrderScreen";
import { TrackScreen } from "./screens/TrackScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { getStoredName } from "./lib/auth";
import type { Route, Nav } from "./lib/nav";

export default function App() {
  // Basit yığın tabanlı navigasyon (harici router'a gerek yok)
  const [stack, setStack] = useState<Route[]>([{ name: "home" }]);
  const route = stack[stack.length - 1];
  // Giriş yapılmış müşteri adı (varsa) — üyelik durumunu ekranlar bilsin.
  const [authName, setAuthName] = useState<string | null>(null);

  useEffect(() => {
    getStoredName().then(setAuthName);
  }, []);

  const nav: Nav = {
    go: (r) => setStack((s) => [...s, r]),
    replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  };

  return (
    <SafeAreaProvider>
      {route.name === "home" && (
        <HomeScreen nav={nav} authName={authName} />
      )}
      {route.name === "profile" && <ProfileScreen nav={nav} id={route.id} />}
      {route.name === "order" && (
        <OrderScreen nav={nav} id={route.id} businessName={route.businessName} />
      )}
      {route.name === "track" && (
        <TrackScreen nav={nav} code={route.code} token={route.token} />
      )}
      {route.name === "auth" && (
        <AuthScreen nav={nav} onAuthed={(n) => setAuthName(n)} />
      )}
    </SafeAreaProvider>
  );
}

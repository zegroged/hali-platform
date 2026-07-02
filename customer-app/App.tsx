import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HomeScreen } from "./screens/HomeScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { OrderScreen } from "./screens/OrderScreen";
import { TrackScreen } from "./screens/TrackScreen";
import type { Route, Nav } from "./lib/nav";

export default function App() {
  // Basit yığın tabanlı navigasyon (harici router'a gerek yok)
  const [stack, setStack] = useState<Route[]>([{ name: "home" }]);
  const route = stack[stack.length - 1];

  const nav: Nav = {
    go: (r) => setStack((s) => [...s, r]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  };

  return (
    <SafeAreaProvider>
      {route.name === "home" && <HomeScreen nav={nav} />}
      {route.name === "profile" && <ProfileScreen nav={nav} id={route.id} />}
      {route.name === "order" && (
        <OrderScreen nav={nav} id={route.id} businessName={route.businessName} />
      )}
      {route.name === "track" && <TrackScreen nav={nav} code={route.code} />}
    </SafeAreaProvider>
  );
}

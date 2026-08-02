// İLÇE → KOORDİNAT (2026-08-03'te ortak yere taşındı)
//
// Keşif sıralaması ("en yakın") ve harita ekranları koordinata muhtaç.
// Fonksiyon 2026-07 kayıt akışında yazılmıştı ve YALNIZ orada duruyordu;
// komisyoncu demo paneli ise koordinatı SABİT İstanbul (41.0082/28.9784)
// veriyordu. Sonuç: demo işletme "Aliağa/İzmir" yazarken rota ve canlı takip
// haritası İstanbul'u gösteriyordu — komisyoncu dükkânda bunu açtığında
// anlatım çöküyordu. Tek kaynağa alındı, iki yerde de bu kullanılıyor.
//
// Nominatim erişilemezse İstanbul merkeziyle döner (kayıt akışının eski
// davranışı korundu; panelden adres güncellenince düzelir).

export async function geocodeDistrict(
  district: string,
  city: string,
): Promise<{ lat: number; lng: number }> {
  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tr&q=" +
      encodeURIComponent(`${district}, ${city}`);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "EnYakinHaliYikama/1.0 (+https://enyakinhaliyikamaservisi.com; destek@enyakinhaliyikamaservisim.com)",
        "Accept-Language": "tr",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length) {
        return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
      }
    }
  } catch {
    // sessiz düş — varsayılan koordinat
  }
  return { lat: 41.0082, lng: 28.9784 };
}

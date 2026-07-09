"use client";

import { useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_KEY } from "@/lib/maps";
import type { PickMapProps } from "@/components/PickMap";

const ISTANBUL = { lat: 41.0082, lng: 28.9784 };

export default function GooglePickMap({
  value,
  onPick,
  height = 260,
}: PickMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "hali-gmaps",
    googleMapsApiKey: GOOGLE_MAPS_KEY,
  });
  // Merkez bir kez sabitlenir; işaret taşındıkça harita zıplamasın.
  const [home] = useState(value ?? ISTANBUL);

  if (!isLoaded) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400"
      >
        Harita yükleniyor…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height, borderRadius: 12 }}
      center={value ?? home}
      zoom={value ? 16 : 12}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
      onClick={(e) => {
        if (e.latLng) onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }}
    >
      {value && (
        <MarkerF
          position={value}
          draggable
          onDragEnd={(e) => {
            if (e.latLng) onPick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }}
        />
      )}
    </GoogleMap>
  );
}

"use client";
import { useState } from "react";
import {
  CITIES,
  districtsOfCity,
  normalizeCityName,
  normalizeDistrictName,
} from "@/lib/cities";

/**
 * İl + bağımlı ilçe seçimi — il/ilçe alanları serbest metin DEĞİL, 81 il ve
 * resmî ilçe listesinden seçilir (yazım hatası şehir sayfası eşleşmesini
 * bozuyordu). Sunucu aksiyonlu (uncontrolled) formlarda kullanılır; name
 * öznitelikleri "city" ve "district" olarak gönderilir.
 */
export default function CityDistrictSelect({
  defaultCity = "",
  defaultDistrict = "",
  selectClass = "",
  labelClass = "",
  required = false,
}: {
  defaultCity?: string;
  defaultDistrict?: string;
  selectClass?: string;
  labelClass?: string;
  required?: boolean;
}) {
  // Eski kayıtlar serbest metin olabilir — listede karşılığı varsa kanonik
  // haliyle seçili başlat, yoksa boş bırak (kullanıcı yeniden seçer).
  const initialCity = normalizeCityName(defaultCity) ?? "";
  const [city, setCity] = useState(initialCity);
  const [district, setDistrict] = useState(
    initialCity ? (normalizeDistrictName(initialCity, defaultDistrict) ?? "") : "",
  );
  const districts = districtsOfCity(city);

  return (
    <>
      <div>
        <label htmlFor="cds-city" className={labelClass}>
          İl
        </label>
        <select
          id="cds-city"
          name="city"
          required={required}
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setDistrict("");
          }}
          className={selectClass}
        >
          <option value="" disabled>
            İl seç
          </option>
          {CITIES.map((c) => (
            <option key={c.slug} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="cds-district" className={labelClass}>
          İlçe
        </label>
        <select
          id="cds-district"
          name="district"
          required={required}
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          disabled={districts.length === 0}
          className={selectClass}
        >
          <option value="" disabled>
            {city ? "İlçe seç" : "Önce il seç"}
          </option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

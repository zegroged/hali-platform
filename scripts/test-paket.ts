/**
 * PAKET KISITLAMASI BİRİM TESTİ (2026-08-09).
 *
 * NEDEN VAR: bu katman "kim neyi görebilir"i belirliyor ve iki yönlü yanlış
 * olabilir — ödeyeni kilitlemek (müşteri kaybı) ya da ödemeyene açık bırakmak
 * (gelir kaybı). İkisi de ekrandan bakarak fark edilmez, çünkü canlıdaki 39
 * işletmenin hepsi bugün YÖNETİM ve dönemi geçerli: kilit hiç TETİKLENMİYOR.
 * Yani bu katmanın doğruluğu YALNIZCA testle bilinebilir.
 *
 * Çalıştır: npx tsx scripts/test-paket.ts
 */
process.env.DATABASE_URL ??= "postgresql://x:x@localhost:5432/x"; // sorgu yok, yalnız import

import {
  etkinPaket,
  modulAcik,
  modulErisimi,
  soforEklenebilir,
  MODUL_ADI,
  type Modul,
} from "../src/lib/paketYetki";
import { SOFOR_TAVANI } from "../src/lib/plan";

let gecti = 0;
let kaldi = 0;
function bekle(ad: string, kosul: boolean, ek = "") {
  if (kosul) {
    gecti++;
    console.log(`  ✓ ${ad}`);
  } else {
    kaldi++;
    console.log(`  ✗ ${ad}${ek ? " — " + ek : ""}`);
  }
}

const ILERI = new Date(Date.now() + 30 * 86400_000);
const GECMIS = new Date(Date.now() - 86400_000);
const MODULLER = Object.keys(MODUL_ADI) as Modul[];

console.log("\nETKİN PAKET — plan ve dönem BİRLİKTE okunur");
bekle("abonelik yok → VITRIN", etkinPaket(null) === "VITRIN");
bekle("undefined → VITRIN", etkinPaket(undefined) === "VITRIN");
bekle(
  "ACTIVE + dönem geçerli + YONETIM → YONETIM",
  etkinPaket({ status: "ACTIVE", currentPeriodEnd: ILERI, plan: "YONETIM" }) === "YONETIM",
);
bekle(
  "ACTIVE + dönem geçerli + FILO → FILO",
  etkinPaket({ status: "ACTIVE", currentPeriodEnd: ILERI, plan: "FILO" }) === "FILO",
);
bekle(
  "🔑 dönem DOLMUŞ YONETIM → VITRIN (düşer, silinmez)",
  etkinPaket({ status: "ACTIVE", currentPeriodEnd: GECMIS, plan: "YONETIM" }) === "VITRIN",
);
bekle(
  "CANCELED ama dönem ileri → VITRIN",
  etkinPaket({ status: "CANCELED", currentPeriodEnd: ILERI, plan: "FILO" }) === "VITRIN",
);
bekle(
  "PAST_DUE → VITRIN",
  etkinPaket({ status: "PAST_DUE", currentPeriodEnd: ILERI, plan: "YONETIM" }) === "VITRIN",
);
bekle(
  "currentPeriodEnd null → VITRIN",
  etkinPaket({ status: "ACTIVE", currentPeriodEnd: null, plan: "YONETIM" }) === "VITRIN",
);
bekle(
  "🔑 FAIL-CLOSED: plan bozuk/eksikse VITRIN",
  etkinPaket({ status: "ACTIVE", currentPeriodEnd: ILERI, plan: null }) === "VITRIN" &&
    etkinPaket({
      status: "ACTIVE",
      currentPeriodEnd: ILERI,
      plan: "SAÇMA" as never,
    }) === "VITRIN",
);
bekle(
  "eski TRIAL kayıtları geriye uyumlu (dönem geçerliyse paketi geçer)",
  etkinPaket({ status: "TRIAL", currentPeriodEnd: ILERI, plan: "YONETIM" }) === "YONETIM",
);

console.log("\nMODÜL KAPISI");
for (const m of MODULLER) {
  bekle(`vitrinde ${m} KAPALI`, modulAcik("VITRIN", m) === false);
}
for (const m of MODULLER) {
  bekle(
    `yönetim+filo ${m} açık`,
    modulAcik("YONETIM", m) === true && modulAcik("FILO", m) === true,
  );
}
bekle(
  "dönemi dolmuş işletmenin KASA'sı kapanır",
  modulErisimi({ status: "ACTIVE", currentPeriodEnd: GECMIS, plan: "YONETIM" }, "KASA") === false,
);
bekle(
  "ödeyen işletmenin KASA'sı KAPANMAZ",
  modulErisimi({ status: "ACTIVE", currentPeriodEnd: ILERI, plan: "YONETIM" }, "KASA") === true,
);
bekle("her modülün ekran adı var", MODULLER.every((m) => MODUL_ADI[m]?.length > 3));

console.log("\nKOLTUK KAPISI — sert kapı");
bekle("vitrin: ilk şoför eklenebilir", soforEklenebilir("VITRIN", 0, 0) === true);
bekle("vitrin: ikinci şoför EKLENEMEZ", soforEklenebilir("VITRIN", 0, 1) === false);
bekle("1 koltuk / 0 şoför → eklenebilir", soforEklenebilir("YONETIM", 1, 0) === true);
bekle("1 koltuk / 1 şoför → EKLENEMEZ", soforEklenebilir("YONETIM", 1, 1) === false);
bekle("2 koltuk / 1 şoför → eklenebilir", soforEklenebilir("YONETIM", 2, 1) === true);
bekle("3 koltuk / 3 şoför → EKLENEMEZ", soforEklenebilir("YONETIM", 3, 3) === false);
bekle(
  `tavan (${SOFOR_TAVANI} koltuk) → sınırsız`,
  soforEklenebilir("YONETIM", SOFOR_TAVANI, 50) === true,
);
bekle("FİLO → her zaman eklenebilir", soforEklenebilir("FILO", 1, 99) === true);
bekle(
  "koltuk 0/bozuk gelse bile en az 1 şoföre izin verir (kilitlenme yok)",
  soforEklenebilir("YONETIM", 0, 0) === true && soforEklenebilir("YONETIM", 0, 1) === false,
);

console.log(`\n${gecti} geçti, ${kaldi} kaldı`);
process.exit(kaldi === 0 ? 0 : 1);

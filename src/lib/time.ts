// Türkiye saati yardımcıları. Türkiye 2016'dan beri kalıcı UTC+3 (yaz saati YOK),
// bu yüzden sabit +3 offset doğru. Sunucu UTC olsa da tüm iş mantığı TR gününe göre.
const TR_OFFSET_MIN = 3 * 60;

function shiftToTr(dt: Date): Date {
  // Epoch'u +3 kaydır; getUTC* alanları artık TR yerel değerlerini verir.
  return new Date(dt.getTime() + TR_OFFSET_MIN * 60 * 1000);
}

/** Şu anın TR gün-içi dakikası (0-1439) ve haftanın günü (0=Pazar). */
export function trNowParts(): { minutes: number; day: number } {
  const tr = shiftToTr(new Date());
  return { minutes: tr.getUTCHours() * 60 + tr.getUTCMinutes(), day: tr.getUTCDay() };
}

/** Bir TR takvim günü (YYYY-MM-DD; yoksa bugün) için UTC yarım-açık aralık [start, end). */
export function trDayBoundsUTC(dateStr?: string): { start: Date; end: Date } {
  let y: number, m: number, d: number;
  if (dateStr) {
    [y, m, d] = dateStr.split("-").map(Number);
  } else {
    const now = shiftToTr(new Date());
    y = now.getUTCFullYear();
    m = now.getUTCMonth() + 1;
    d = now.getUTCDate();
  }
  const h = TR_OFFSET_MIN / 60; // 3
  // TR 00:00 = UTC (00:00 - 3s)
  const start = new Date(Date.UTC(y, m - 1, d, -h, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 1, -h, 0, 0));
  return { start, end };
}

/** Bir tarihin TR yılı ve ayı (durak dönem raporu için). */
export function trYearMonth(dt: Date): { year: number; month: number } {
  const tr = shiftToTr(dt);
  return { year: tr.getUTCFullYear(), month: tr.getUTCMonth() + 1 };
}

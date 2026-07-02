import type { OrderStatus } from "@prisma/client";

// İkonlar için OrderStatusIcon (SVG) kullanılır — bkz components/icons.tsx.
export const ORDER_STATUS_META: Record<OrderStatus, { label: string }> = {
  CREATED: { label: "Talep alındı" },
  ACCEPTED: { label: "Kabul edildi" },
  REJECTED: { label: "Reddedildi" },
  PICKED_UP: { label: "Halı alındı" },
  WASHING: { label: "Yıkanıyor" },
  OUT_FOR_DELIVERY: { label: "Yola çıktı" },
  DELIVERED: { label: "Teslim edildi" },
  CANCELED: { label: "İptal edildi" },
};

// Müşteri takip çubuğunun sıralı adımları
export const CUSTOMER_FLOW: OrderStatus[] = [
  "CREATED",
  "ACCEPTED",
  "PICKED_UP",
  "WASHING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// advanceOrder'ın işlediği ara geçişler. (ACCEPTED→PICKED_UP savePickup'a,
// OUT_FOR_DELIVERY→DELIVERED deliverOrder'a ait — burada YOK, kafa karıştırmasın.)
export const DRIVER_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  PICKED_UP: "WASHING",
  WASHING: "OUT_FOR_DELIVERY",
};

// Halıcının panelden ilerletebileceği ara geçişler + buton etiketleri.
// (CREATED→ACCEPTED acceptOrderPanel'e, OUT_FOR_DELIVERY→DELIVERED tutar
// gerektirdiği için deliverOrderPanel'e ait — burada YOK.)
export const PANEL_NEXT: Partial<
  Record<OrderStatus, { next: OrderStatus; action: string }>
> = {
  ACCEPTED: { next: "PICKED_UP", action: "Halı alındı olarak işaretle" },
  PICKED_UP: { next: "WASHING", action: "Yıkamaya alındı olarak işaretle" },
  WASHING: { next: "OUT_FOR_DELIVERY", action: "Yola çıktı olarak işaretle" },
};

// Hazır red sebepleri (dropdown)
export const REJECT_REASONS = [
  "Yoğunluk / kapasite dolu",
  "Hizmet bölgesi dışı",
  "Uygun olmayan halı / hizmet",
  "Çalışma saati dışı",
  "Diğer",
];

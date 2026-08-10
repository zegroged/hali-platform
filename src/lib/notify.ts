import { prisma } from "@/lib/prisma";

// Uygulama-içi bildirim üretimi. SMS mock olduğu için içerideki kullanıcılara
// (halıcı/şoför/admin) ulaşmanın asıl kanalı budur — panel/şoför başlığındaki
// zil bunları gösterir. HER çağrı best-effort: bildirim yazımı asıl akışı
// (sipariş oluşturma vb.) ASLA bozmamalı, o yüzden çağıran try/catch'e sarmalı
// VEYA buradaki güvenli sarmalayıcıları kullanmalı.

export type NotifyInput = {
  userId: string;
  type:
    | "yeni-siparis"
    | "fiyat-onay"
    | "is-atandi"
    | "iptal"
    | "dogrulama"
    | "genel";
  title: string;
  body?: string;
  href?: string;
  /** Uygulamanın DAVRANIŞ ÜRETMESİ için ek veri (2026-08-10).
   *  Örnek: `{ tip: "konum-yeniden-baslat" }` — şoför uygulaması bunu alınca
   *  konum akışını yeniden başlatır. Panel/web tarafı görmezden gelir. */
  ekstra?: Record<string, string>;
};

/** Tek kullanıcıya bildirim (best-effort; hata yutulur, akışı bozmaz).
 *
 *  TELEFON BİLDİRİMİ (2026-08-05): zil kaydının yanına push da gönderilir.
 *  Tek noktadan yapılıyor ki her bildirim türü (yeni sipariş, fiyat onayı,
 *  iş atama, WhatsApp mesajı…) kendiliğinden telefona düşsün — her çağrı
 *  yerine ayrı ayrı push eklemek klasik "biri unutulur" tuzağıydı.
 *  Push YAZIMDAN SONRA ve `await` ile: sıra önemli değil ama hata ayrı
 *  yakalanmalı, push patlarsa zil kaydı yine de durmalı. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      },
    });
  } catch (e) {
    console.error("bildirim yazılamadı:", e);
  }
  try {
    const { pushGonder } = await import("@/lib/push");
    await pushGonder(input.userId, input.title, input.body, input.href, input.ekstra);
  } catch (e) {
    console.error("push gönderilemedi:", e);
  }
}

/** Birden çok kullanıcıya aynı bildirim (best-effort). */
export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  if (uniq.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: uniq.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      })),
    });
  } catch (e) {
    console.error("toplu bildirim yazılamadı:", e);
  }
}

/** Tüm admin kullanıcılara bildirim (doğrulama talebi vb.). */
export async function notifyAdmins(
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", bannedAt: null },
      select: { id: true },
    });
    await notifyMany(
      admins.map((a) => a.id),
      input,
    );
  } catch (e) {
    console.error("admin bildirimi yazılamadı:", e);
  }
}

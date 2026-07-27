"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { sonrakiTarih, KATEGORI_ETIKET } from "@/lib/ledger";
import type { LedgerCategory, LedgerKind } from "@prisma/client";

// KASA (gelir-gider) aksiyonları — yalnız işletmenin KENDİ kayıtları.
// Her aksiyonda sahiplik kontrolü: businessId oturumdan gelir, formdan DEĞİL.


async function biz() {
  const b = await getCurrentBusiness();
  if (!b) redirect("/giris");
  return b!;
}

const hata = (m: string) => {
  redirect("/panel/kasa?hata=" + encodeURIComponent(m));
};

function tutarOku(raw: string): number {
  // "1.250,50" ve "1250.50" birlikte çalışsın (TR klavye alışkanlığı).
  const t = raw.trim().replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  return Number(t);
}

export async function addLedgerEntry(formData: FormData) {
  const b = await biz();
  const kind = (String(formData.get("kind") || "EXPENSE") === "INCOME"
    ? "INCOME"
    : "EXPENSE") as LedgerKind;
  // KATEGORİ ARTIK SERBEST METİN (2026-07-27). Halıcı ne yazarsa o görünür.
  // Yazdığı hazır kalıplardan birine denk gelirse enum'a da oturtuyoruz ki
  // eski kayıtlarla aynı kovada toplansın; denk gelmezse kova DIGER olur ama
  // ekranda kendi yazdığı ad görünür.
  const catRaw = String(formData.get("category") || "").trim();
  const categoryLabel = catRaw.slice(0, 40);
  const eslesen = (Object.keys(KATEGORI_ETIKET) as LedgerCategory[]).find(
    (k) =>
      KATEGORI_ETIKET[k].toLocaleLowerCase("tr") ===
      categoryLabel.toLocaleLowerCase("tr"),
  );
  const category: LedgerCategory = eslesen ?? "DIGER";
  const label = String(formData.get("label") || "").trim();
  const amount = tutarOku(String(formData.get("amount") || ""));
  const dateRaw = String(formData.get("date") || "").trim();
  const note = String(formData.get("note") || "").trim();
  // Tekrarlama (opsiyonel): her N gün ya da her ayın X'i.
  const everyDaysRaw = String(formData.get("everyDays") || "").trim();
  const monthDayRaw = String(formData.get("monthDay") || "").trim();

  if (label.length < 2) hata("Kalem adı girin (ör. Ahmet maaş, Deterjan).");
  if (!Number.isFinite(amount) || amount <= 0) hata("Tutar sıfırdan büyük olmalı.");
  if (amount > 10_000_000) hata("Tutar çok büyük görünüyor — kontrol edin.");
  const date = dateRaw ? new Date(dateRaw + "T09:00:00") : new Date();
  if (Number.isNaN(date.getTime())) hata("Tarih geçersiz.");

  const everyDays = everyDaysRaw ? Number(everyDaysRaw) : null;
  const monthDay = monthDayRaw ? Number(monthDayRaw) : null;
  if (everyDays != null && (!Number.isInteger(everyDays) || everyDays < 1 || everyDays > 365))
    hata("Tekrar aralığı 1-365 gün arasında olmalı.");
  if (monthDay != null && (!Number.isInteger(monthDay) || monthDay < 1 || monthDay > 28))
    hata("Ayın günü 1-28 arasında olmalı (ay sonu kaymasın diye).");
  if (everyDays != null && monthDay != null)
    hata("Ya 'her N gün' ya 'her ayın X'i' — ikisini birlikte seçme.");

  await prisma.$transaction(async (tx) => {
    let recurrenceId: string | null = null;
    if (everyDays != null || monthDay != null) {
      const kural = await tx.ledgerRecurrence.create({
        data: {
          businessId: b.id,
          kind,
          category,
          label,
          amount,
          everyDays,
          monthDay,
          // İlk kayıt hemen aşağıda elle yazılıyor; bir sonraki vade ondan sonra.
          nextRunAt: sonrakiTarih(date, everyDays, monthDay),
        },
      });
      recurrenceId = kural.id;
    }
    await tx.ledgerEntry.create({
      data: {
        businessId: b.id,
        kind,
        category,
        label,
        amount,
        date,
        note: note || null,
        recurrenceId,
      },
    });
  });

  revalidatePath("/panel/kasa");
  redirect("/panel/kasa?ok=1");
}

export async function deleteLedgerEntry(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id") || "");
  // SAHİPLİK: yalnız kendi kaydını siler (deleteMany + businessId koşulu).
  await prisma.ledgerEntry.deleteMany({ where: { id, businessId: b.id } });
  revalidatePath("/panel/kasa");
}

export async function toggleRecurrence(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id") || "");
  const k = await prisma.ledgerRecurrence.findFirst({
    where: { id, businessId: b.id },
    select: { id: true, active: true, everyDays: true, monthDay: true },
  });
  if (!k) return;
  await prisma.ledgerRecurrence.updateMany({
    where: { id: k.id, active: k.active }, // koşullu yaz (TOCTOU)
    data: {
      active: !k.active,
      // Yeniden başlatılırken vade bugünden ileri alınır (geriye dönük
      // yığın kayıt üretmesin).
      ...(k.active ? {} : { nextRunAt: sonrakiTarih(new Date(), k.everyDays, k.monthDay) }),
    },
  });
  revalidatePath("/panel/kasa");
}

export async function deleteRecurrence(formData: FormData) {
  const b = await biz();
  const id = String(formData.get("id") || "");
  // Kural silinir, geçmiş kayıtlar KALIR (SetNull) — muhasebe geçmişi bozulmasın.
  await prisma.ledgerRecurrence.deleteMany({ where: { id, businessId: b.id } });
  revalidatePath("/panel/kasa");
}

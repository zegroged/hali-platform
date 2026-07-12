import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Şehir taleplerini CSV olarak indir (yalnız ADMIN) — Excel'de açılır.
export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const leads = await prisma.cityLead.findMany({
    orderBy: [{ city: "asc" }, { createdAt: "desc" }],
  });

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [
    "sehir;ilce;eposta;kayit_tarihi;mujde_maili",
    ...leads.map((l) =>
      [
        esc(l.city),
        esc(l.district ?? ""),
        esc(l.email),
        l.createdAt.toISOString().slice(0, 10),
        l.notifiedAt ? l.notifiedAt.toISOString().slice(0, 10) : "",
      ].join(";"),
    ),
  ].join("\r\n");

  // BOM: Excel'in Türkçe karakterleri doğru açması için şart.
  return new NextResponse("﻿" + rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sehir-talepleri.csv"',
    },
  });
}

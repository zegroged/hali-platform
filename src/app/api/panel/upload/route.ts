import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBusiness } from "@/lib/panel";
import { saveObject } from "@/lib/storage";

const MAX = 5 * 1024 * 1024; // 5 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Çoklu fotoğraf yükleme. AWS_S3_BUCKET varsa S3'e, yoksa yerel diske (saveObject seçer).
export async function POST(req: NextRequest) {
  const b = await getCurrentBusiness();
  if (!b) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const form = await req.formData();
  const kind = String(form.get("kind") || "after");
  const files = form
    .getAll("files")
    .filter((f): f is File => f instanceof File)
    .slice(0, 10); // tek istekte en fazla 10 dosya (DoS/şişme koruması)
  if (!files.length) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }

  let count = 0;
  for (const file of files) {
    const ext = ALLOWED[file.type];
    if (!ext || file.size > MAX) continue;
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await saveObject(`uploads/${b.id}/${name}`, buf, file.type);
    await prisma.businessPhoto.create({
      data: {
        businessId: b.id,
        url,
        isBefore: kind === "before",
        isAfter: kind === "after",
      },
    });
    count++;
  }

  if (count === 0) {
    return NextResponse.json(
      { error: "Geçerli görsel yok (jpg/png/webp, ≤5MB)" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, count });
}

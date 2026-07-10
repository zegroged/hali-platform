import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth";

// Bildirimleri okundu işaretle. Gövdede {id} varsa yalnız onu, yoksa TÜMÜNÜ.
// where'e userId koşulu: başkasının bildirimini işaretleyememeli.
export async function POST(req: NextRequest) {
  const u = await getAuthedUser();
  if (!u) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : null;

  await prisma.notification.updateMany({
    where: {
      userId: u.id,
      readAt: null,
      ...(id ? { id } : {}),
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

import { Prisma } from "@prisma/client";

// Karışmasın diye 0/O/1/I yok → 32^6 ≈ 1 milyar olası kod.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genOrderCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) {
    c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return c;
}

/**
 * Benzersiz kodla sipariş oluşturur. Check-then-insert YERİNE atomik create +
 * çakışmada (P2002) yeniden dene → eşzamanlı isteklerde 500 yerine doğru davranış.
 * `build(code)` verilen kodla order create eden fonksiyondur.
 */
export async function createOrderWithCode<T>(
  build: (code: string) => Promise<T>,
): Promise<T> {
  for (let i = 0; i < 8; i++) {
    try {
      return await build(genOrderCode());
    } catch (e) {
      // code veya trackingToken benzersizlik çakışması → yeni kodla tekrar dene
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Benzersiz sipariş kodu üretilemedi");
}

// Dosya depolama. AWS_S3_BUCKET varsa S3'e yükler, yoksa yerel diske (public/uploads).
// Geriye sadece .env anahtarlarını girmek kalır.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const BUCKET = process.env.AWS_S3_BUCKET ?? "";
export const hasS3 = BUCKET.length > 0;
const REGION = process.env.AWS_REGION ?? "eu-central-1";

const s3 = hasS3
  ? new S3Client({
      region: REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
          }
        : undefined,
    })
  : null;

// key: "uploads/<businessId>/<dosya>". Döndürdüğü URL doğrudan kullanılabilir.
export async function saveObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const base =
      process.env.AWS_S3_PUBLIC_URL ??
      `https://${BUCKET}.s3.${REGION}.amazonaws.com`;
    return `${base}/${key}`;
  }
  // yerel disk: public/<key> → /<key> adresinden servis edilir
  const full = path.join(process.cwd(), "public", key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return "/" + key;
}

import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// ============================================================================
// Cloudflare R2 — S3-compatible client (server-side only)
// ============================================================================

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials tidak ditemukan. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY di .env");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "sertifikat";

/** Upload buffer ke R2 */
export async function uploadToR2(key: string, body: Buffer, contentType = "application/pdf") {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Cek apakah object ada di R2 */
export async function existsInR2(key: string): Promise<boolean> {
  try {
    const client = getR2Client();
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Stream object dari R2, kembalikan buffer bytes + contentType */
export async function getFromR2(key: string) {
  const client = getR2Client();
  const res = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  if (!res.Body) throw new Error("Empty body from R2");
  // transformToByteArray() buffers seluruh object — menghindari EPIPE saat stream disconnect
  const bytes = await res.Body.transformToByteArray();
  return {
    bytes,
    contentType: res.ContentType ?? "application/pdf",
    contentLength: res.ContentLength,
  };
}

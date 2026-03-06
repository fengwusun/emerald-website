import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3Client() {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION is required for signed URL generation");
  }

  return new S3Client({
    region,
    endpoint: process.env.AWS_ENDPOINT_URL || undefined
  });
}

export function normalizeStorageKey(storageKey: string): string {
  const prefix = process.env.EMERALD_ASSET_PREFIX ?? "";
  const cleanedPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const cleanedKey = storageKey.replace(/^\/+/, "");

  if (cleanedPrefix.length === 0) {
    return cleanedKey;
  }
  return `${cleanedPrefix}/${cleanedKey}`;
}

export async function createSignedAssetUrl(storageKey: string): Promise<string> {
  const bucket = process.env.EMERALD_ASSET_BUCKET;
  if (!bucket) {
    throw new Error("EMERALD_ASSET_BUCKET is required for signed URL generation");
  }

  const ttl = Number(process.env.EMERALD_SIGNED_URL_TTL_SECONDS ?? "900");
  const expiresIn = Number.isFinite(ttl) && ttl > 0 ? ttl : 900;

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: normalizeStorageKey(storageKey)
  });

  return getSignedUrl(client, command, { expiresIn });
}

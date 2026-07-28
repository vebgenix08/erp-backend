import type { StorageUrlPort } from "./files.service";

let singleton: StorageUrlPort | undefined;

export function createS3StorageUrlPort(): StorageUrlPort {
  if (singleton) return singleton;
  singleton = {
    async createUploadUrl(input) {
      const [{ PutObjectCommand, S3Client }, { getSignedUrl }] = await Promise.all([
        import("@aws-sdk/client-s3"),
        import("@aws-sdk/s3-request-presigner"),
      ]);
      const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
      const url = await getSignedUrl(
        new S3Client({}),
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.storageKey,
          ContentType: input.contentType,
        }),
        { expiresIn: input.expiresInSeconds },
      );
      return {
        url,
        expiresAt,
        headers: { "content-type": input.contentType },
      };
    },
    async createDownloadUrl(input) {
      const [{ GetObjectCommand, S3Client }, { getSignedUrl }] = await Promise.all([
        import("@aws-sdk/client-s3"),
        import("@aws-sdk/s3-request-presigner"),
      ]);
      const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
      const url = await getSignedUrl(
        new S3Client({}),
        new GetObjectCommand({ Bucket: input.bucket, Key: input.storageKey }),
        { expiresIn: input.expiresInSeconds },
      );
      return { url, expiresAt };
    },
  };
  return singleton;
}

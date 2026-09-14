import type { StorageUrlPort } from "./files.service";
import { BadRequestError } from "@school-erp/errors";

let singleton: StorageUrlPort | undefined;

export function createS3StorageUrlPort(): StorageUrlPort {
  if (singleton) return singleton;
  singleton = {
    async verifyUpload(input) {
      const { HeadObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
      let object;
      try {
        object = await new S3Client({}).send(
          new HeadObjectCommand({ Bucket: input.bucket, Key: input.storageKey }),
        );
      } catch (error) {
        if (
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        ) {
          throw new BadRequestError("uploaded file was not found in storage");
        }
        throw error;
      }
      if (object.ContentType?.toLowerCase() !== input.contentType.toLowerCase())
        throw new BadRequestError("uploaded file type does not match");
      if (input.sizeBytes !== undefined && object.ContentLength !== input.sizeBytes)
        throw new BadRequestError("uploaded file size does not match");
    },
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

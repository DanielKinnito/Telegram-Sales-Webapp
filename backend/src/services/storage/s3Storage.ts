import type { StorageProvider } from "./types.js";

export interface S3StorageOptions {
  bucketName?: string | undefined;
  region?: string | undefined;
  endpoint?: string | undefined; // For Cloudflare R2 or custom S3-compatible endpoints
  accessKeyId?: string | undefined;
  secretAccessKey?: string | undefined;
  publicBaseUrl?: string | undefined;
}

/**
 * AWS S3 & Cloudflare R2 Storage Adapter stub.
 * Ready for drop-in migration when moving from Supabase to AWS S3 / Cloudflare R2.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(options: S3StorageOptions = {}) {
    this.bucketName = options.bucketName || "payment-proofs";
    this.publicBaseUrl =
      options.publicBaseUrl || `https://${this.bucketName}.s3.amazonaws.com`;
  }

  public async uploadFile(
    _buffer: Buffer,
    filename: string,
    _mimeType: string = "image/jpeg"
  ): Promise<string> {
    // S3 driver hook: When migrating to S3/R2, install @aws-sdk/client-s3
    // and execute PutObjectCommand here.
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `receipts/${Date.now()}-${cleanName}`;

    // For now, if configured without AWS SDK, return calculated public URL or throw
    return this.getPublicUrl(filePath);
  }

  public getPublicUrl(filePath: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, "")}/${filePath.replace(/^\//, "")}`;
  }
}

/**
 * Provider-agnostic storage abstraction.
 * Allows zero-vendor-lockin switching between Supabase Storage, AWS S3, Cloudflare R2, or Mock drivers.
 */
export interface StorageProvider {
  /**
   * Upload a file buffer and return the publicly accessible CDN URL.
   */
  uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<string>;

  /**
   * Resolve the public URL for a previously uploaded file path.
   */
  getPublicUrl(filePath: string): string;
}

export type StorageDriverType = "supabase" | "s3" | "r2" | "mock";

export interface StorageOptions {
  provider?: StorageDriverType | undefined;
  bucketName?: string | undefined;
  supabaseUrl?: string | undefined;
  supabaseAnonKey?: string | undefined;
}

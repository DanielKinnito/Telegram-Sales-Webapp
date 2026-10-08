import { env } from "../../config/env.js";
import type { StorageProvider, StorageDriverType, StorageOptions } from "./types.js";
import { SupabaseStorageProvider } from "./supabaseStorage.js";
import { S3StorageProvider } from "./s3Storage.js";
import { MockStorageProvider } from "./mockStorage.js";

export * from "./types.js";
export * from "./supabaseStorage.js";
export * from "./s3Storage.js";
export * from "./mockStorage.js";

let activeProvider: StorageProvider | null = null;

/**
 * Factory to create a StorageProvider based on configuration or environment.
 */
export function createStorageProvider(options: StorageOptions = {}): StorageProvider {
  const provider = options.provider || (env.STORAGE_PROVIDER as StorageDriverType) || "supabase";
  const bucketName = options.bucketName || env.SUPABASE_BUCKET_NAME || "payment-proofs";

  switch (provider) {
    case "supabase": {
      const url = options.supabaseUrl || env.SUPABASE_URL;
      const key = options.supabaseAnonKey || env.SUPABASE_ANON_KEY;
      if (!url || !key) {
        console.warn(
          "⚠️ SUPABASE_URL or SUPABASE_ANON_KEY missing; falling back to MockStorageProvider"
        );
        return new MockStorageProvider();
      }
      return new SupabaseStorageProvider({
        supabaseUrl: url,
        supabaseAnonKey: key,
        bucketName,
      });
    }
    case "s3":
    case "r2":
      return new S3StorageProvider({ bucketName });
    case "mock":
      return new MockStorageProvider();
    default:
      throw new Error(`Unsupported storage provider: ${provider}`);
  }
}

/**
 * Returns the active singleton StorageProvider instance.
 */
export function getStorageProvider(): StorageProvider {
  if (!activeProvider) {
    activeProvider = createStorageProvider();
  }
  return activeProvider;
}

/**
 * Allows overriding the active storage provider (useful for unit tests).
 */
export function setStorageProvider(provider: StorageProvider | null): void {
  activeProvider = provider;
}

/**
 * Convenience helper to upload a payment proof receipt image.
 */
export async function uploadPaymentProof(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  return getStorageProvider().uploadFile(fileBuffer, fileName, contentType);
}

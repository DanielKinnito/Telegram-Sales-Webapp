import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "./types.js";

export interface SupabaseStorageOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucketName?: string | undefined;
  client?: SupabaseClient | undefined;
}

export class SupabaseStorageProvider implements StorageProvider {
  private readonly client: SupabaseClient;
  private readonly bucketName: string;

  constructor(options: SupabaseStorageOptions) {
    this.bucketName = options.bucketName || "payment-proofs";

    if (options.client) {
      this.client = options.client;
    } else {
      if (!options.supabaseUrl || !options.supabaseAnonKey) {
        throw new Error(
          "SupabaseStorageProvider requires valid SUPABASE_URL and SUPABASE_ANON_KEY"
        );
      }
      this.client = createClient(options.supabaseUrl, options.supabaseAnonKey);
    }
  }

  public async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string = "image/jpeg"
  ): Promise<string> {
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `receipts/${Date.now()}-${cleanName}`;

    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload proof image: ${error.message}`);
    }

    return this.getPublicUrl(data.path);
  }

  public getPublicUrl(filePath: string): string {
    const { data } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}

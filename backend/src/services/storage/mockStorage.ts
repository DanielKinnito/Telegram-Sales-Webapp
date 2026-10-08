import type { StorageProvider } from "./types.js";

export class MockStorageProvider implements StorageProvider {
  public uploadedFiles: Map<string, { buffer: Buffer; mimeType: string }> = new Map();

  public async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string = "image/jpeg"
  ): Promise<string> {
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `receipts/${Date.now()}-${cleanName}`;
    this.uploadedFiles.set(filePath, { buffer, mimeType });
    return this.getPublicUrl(filePath);
  }

  public getPublicUrl(filePath: string): string {
    return `https://mock-storage.local/${filePath}`;
  }
}

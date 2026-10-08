import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SupabaseStorageProvider,
  S3StorageProvider,
  MockStorageProvider,
  createStorageProvider,
  setStorageProvider,
  uploadPaymentProof,
} from "./index.js";

describe("Storage Layer (Adapter Pattern)", () => {
  beforeEach(() => {
    setStorageProvider(null);
  });

  describe("SupabaseStorageProvider", () => {
    it("successfully uploads buffer and returns public CDN URL", async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: "receipts/12345-receipt.jpg" },
        error: null,
      });

      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: "https://xyz.supabase.co/storage/v1/object/public/payment-proofs/receipts/12345-receipt.jpg" },
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            getPublicUrl: mockGetPublicUrl,
          }),
        },
      } as any;

      const provider = new SupabaseStorageProvider({
        supabaseUrl: "https://xyz.supabase.co",
        supabaseAnonKey: "sb_publishable_test_key",
        bucketName: "payment-proofs",
        client: mockClient,
      });

      const buffer = Buffer.from("fake-image-bytes");
      const url = await provider.uploadFile(buffer, "receipt.jpg", "image/jpeg");

      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(/^receipts\/\d+-receipt\.jpg$/),
        buffer,
        { contentType: "image/jpeg", upsert: false }
      );
      expect(mockGetPublicUrl).toHaveBeenCalledWith("receipts/12345-receipt.jpg");
      expect(url).toBe(
        "https://xyz.supabase.co/storage/v1/object/public/payment-proofs/receipts/12345-receipt.jpg"
      );
    });

    it("throws a descriptive error when Supabase upload fails", async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Bucket not found or permission denied" },
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
          }),
        },
      } as any;

      const provider = new SupabaseStorageProvider({
        supabaseUrl: "https://xyz.supabase.co",
        supabaseAnonKey: "sb_publishable_test_key",
        client: mockClient,
      });

      await expect(
        provider.uploadFile(Buffer.from("test"), "doc.pdf", "application/pdf")
      ).rejects.toThrow(/Failed to upload proof image: Bucket not found/i);
    });
  });

  describe("S3StorageProvider", () => {
    it("generates correct public URL formatting for S3/R2 migration", async () => {
      const s3Provider = new S3StorageProvider({
        bucketName: "payment-proofs",
        publicBaseUrl: "https://cdn.mycompany.com",
      });

      const url = await s3Provider.uploadFile(Buffer.from("sample"), "receipt.png", "image/png");
      expect(url).toMatch(/^https:\/\/cdn\.mycompany\.com\/receipts\/\d+-receipt\.png$/);
    });
  });

  describe("MockStorageProvider", () => {
    it("stores buffer in memory and returns accessible mock URL", async () => {
      const mockProvider = new MockStorageProvider();
      const buffer = Buffer.from("test-receipt-data");
      const url = await mockProvider.uploadFile(buffer, "test.jpg", "image/jpeg");

      expect(url).toMatch(/^https:\/\/mock-storage\.local\/receipts\/\d+-test\.jpg$/);
      expect(mockProvider.uploadedFiles.size).toBe(1);
    });
  });

  describe("createStorageProvider & uploadPaymentProof", () => {
    it("creates MockStorageProvider when explicitly requested", () => {
      const provider = createStorageProvider({ provider: "mock" });
      expect(provider).toBeInstanceOf(MockStorageProvider);
    });

    it("creates S3StorageProvider when requested", () => {
      const provider = createStorageProvider({ provider: "s3" });
      expect(provider).toBeInstanceOf(S3StorageProvider);
    });

    it("uploadPaymentProof helper delegates to active provider", async () => {
      const mockProvider = new MockStorageProvider();
      setStorageProvider(mockProvider);

      const url = await uploadPaymentProof(Buffer.from("abc"), "proof.jpg");
      expect(url).toContain("mock-storage.local");
      expect(mockProvider.uploadedFiles.size).toBe(1);
    });
  });
});

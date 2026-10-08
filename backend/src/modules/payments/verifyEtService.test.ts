import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VerifyEtService } from "./verifyEtService.js";

describe("VerifyEtService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects references that are too short", async () => {
    const service = new VerifyEtService();
    await expect(
      service.verifyTransaction({
        provider: "cbe",
        referenceNumber: "12",
      })
    ).rejects.toThrow("Validation Error");
  });

  it("handles sandbox verification successfully", async () => {
    const service = new VerifyEtService(undefined);
    const result = await service.verifyTransaction({
      provider: "telebirr",
      referenceNumber: "TB1234567890",
      expectedAmount: 50000,
    });

    expect(result.verified).toBe(true);
    expect(result.provider).toBe("telebirr");
    expect(result.amount).toBe(50000);
    expect(result.currency).toBe("ETB");
    expect(result.receiptUrl).toContain("TB1234567890");
  });

  it("simulates rejection for invalid test references in sandbox mode", async () => {
    const service = new VerifyEtService(undefined);
    const result = await service.verifyTransaction({
      provider: "cbe",
      referenceNumber: "INVALID999",
    });

    expect(result.verified).toBe(false);
  });

  it("calls live Verify.ET API when API key is provided", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        data: {
          amount: 75000,
          sender_name: "Alemayehu Tesfaye",
          transaction_date: "2026-10-08T12:00:00Z",
          receipt_url: "https://verify.et/receipt/FT12345678",
        },
      }),
    });

    const service = new VerifyEtService("test_key_123");
    const result = await service.verifyTransaction({
      provider: "cbe",
      referenceNumber: "FT12345678",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.verify.et/api/v1/verify",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(result.verified).toBe(true);
    expect(result.amount).toBe(75000);
    expect(result.senderName).toBe("Alemayehu Tesfaye");
  });
});

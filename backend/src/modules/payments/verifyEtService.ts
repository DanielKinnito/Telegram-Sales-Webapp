import { env } from "../../config/env.js";

export type SupportedBankProvider =
  | "cbe"
  | "telebirr"
  | "dashen"
  | "boa"
  | "awash"
  | "cbe_birr"
  | "amole"
  | "other";

export interface VerifyTransactionInput {
  provider: SupportedBankProvider;
  referenceNumber: string;
  accountSuffix?: string;
  expectedAmount?: number;
}

export interface VerifyTransactionResult {
  verified: boolean;
  provider: SupportedBankProvider;
  providerName: string;
  referenceNumber: string;
  amount?: number;
  currency: string;
  senderName?: string;
  transactionTime?: string;
  receiptUrl?: string;
  verificationBadge: string;
  message: string;
  rawResponse?: Record<string, unknown>;
}

export const BANK_DISPLAY_NAMES: Record<SupportedBankProvider, string> = {
  cbe: "Commercial Bank of Ethiopia (CBE)",
  telebirr: "Telebirr (Ethio Telecom)",
  dashen: "Dashen Bank / Amole",
  boa: "Bank of Abyssinia",
  awash: "Awash International Bank",
  cbe_birr: "CBE Birr",
  amole: "Amole Digital",
  other: "Ethiopian Bank Transfer",
};

export class VerifyEtService {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(apiKey?: string, baseUrl = "https://api.verify.et/api/v1") {
    this.apiKey = apiKey || env.VERIFY_ET_API_KEY;
    this.baseUrl = baseUrl;
  }

  /**
   * Verify an Ethiopian bank/mobile money transaction reference.
   * Can verify CBE FT numbers, Telebirr transaction IDs, Dashen, etc.
   */
  public async verifyTransaction(
    input: VerifyTransactionInput
  ): Promise<VerifyTransactionResult> {
    const ref = input.referenceNumber?.trim();
    if (!ref || ref.length < 4) {
      throw new Error(
        "Validation Error: Transaction reference number must be at least 4 characters long."
      );
    }

    const providerName = BANK_DISPLAY_NAMES[input.provider] || "Ethiopian Bank";

    // 1. If live Verify.ET API key is available, execute native HTTP fetch
    if (this.apiKey) {
      try {
        const response = await fetch(`${this.baseUrl}/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: input.provider,
            reference: ref,
            account_suffix: input.accountSuffix,
            amount: input.expectedAmount,
          }),
        });

        const data: any = await response.json();
        const isSuccess = response.ok && (data?.status === "success" || data?.verified === true);
        const verifiedAmount = data?.data?.amount || data?.amount;
        const sender = data?.data?.sender_name || data?.sender;
        const dateStr = data?.data?.transaction_date || new Date().toISOString();

        return {
          verified: isSuccess,
          provider: input.provider,
          providerName,
          referenceNumber: ref,
          amount: verifiedAmount,
          currency: "ETB",
          senderName: sender,
          transactionTime: dateStr,
          receiptUrl: data?.data?.receipt_url || `https://verify.et/receipt/${ref}`,
          verificationBadge: isSuccess
            ? `Verified by Verify.ET (${providerName} - Ref: ${ref})`
            : "Verification Failed",
          message: isSuccess
            ? `Successfully verified payment of ${verifiedAmount ? `${verifiedAmount} ETB` : "funds"} via ${providerName}.`
            : (data?.message || "Payment reference could not be verified with the bank."),
          rawResponse: data,
        };
      } catch (err: any) {
        throw new Error(`Verify.ET API Error: ${err.message || "Failed to contact Verify.ET"}`);
      }
    }

    // 2. Intelligent Simulation/Sandbox Mode when no API key configured yet
    const mockVerified = !ref.toUpperCase().startsWith("INVALID");
    const mockAmount = input.expectedAmount || 25000;
    const nowIso = new Date().toISOString();

    return {
      verified: mockVerified,
      provider: input.provider,
      providerName,
      referenceNumber: ref,
      amount: mockVerified ? mockAmount : undefined,
      currency: "ETB",
      senderName: mockVerified ? "Client Payer (Ethiopia)" : undefined,
      transactionTime: nowIso,
      receiptUrl: `https://verify.et/sandbox/receipt/${ref}`,
      verificationBadge: mockVerified
        ? `[Sandbox Verified] Verify.ET (${providerName} - Ref: ${ref})`
        : "Verification Failed (Sandbox)",
      message: mockVerified
        ? `[Sandbox] Verified transaction ${ref} for ${mockAmount.toLocaleString()} ETB via ${providerName}.`
        : `[Sandbox] Transaction reference ${ref} was rejected by provider.`,
    };
  }
}

# Payment Proof Verification Architectures

This document preserves the architecture, configuration, and implementation references for earlier payment proof methods evaluated for this project before adopting the **Bank Transaction Share Link (SMS / Mobile Banking)** approach.

---

## 1. Current Architecture: Bank Transaction Share Link (SMS / Mobile Banking)

### Concept & Ethiopian Banking Workflow
Most Ethiopian financial institutions (Commercial Bank of Ethiopia, Telebirr, Dashen Bank / Amole, Bank of Abyssinia, Awash Bank, etc.) generate an official web transaction link whenever a deposit, transfer, or merchant payment occurs:
1. **SMS Confirmation:** Banks send an SMS with a confirmation link (e.g., `https://cbe.et/...` or `https://telebirr.et/...`).
2. **Mobile Banking "Share Receipt":** Every mobile banking application provides an in-app "Share Receipt / Share Transaction" button that copies a verified transaction confirmation URL.

### Data Flow
1. **Sales Rep:** Copies the link from the SMS or banking app and pastes it into the Telegram Mini App.
2. **Backend:** Validates that the URL starts with `http://` or `https://`.
3. **Notion CRM:** Stores the URL directly in the `Payment Proof URL` property (`type: url`) of the Deals Database.
4. **Manager Notification:** Dispatches an instant Telegram alert to Executive Managers containing the direct clickable link and deal amount.
5. **Manager Verification:** The manager clicks the link to view the bank's official HTTPS confirmation page and approves the deal in Notion.

---

## 2. Archived Architecture A: Object Storage Receipt Upload (Supabase / AWS S3 / Cloudflare R2)

### Overview
Allowed reps to take a picture of a counter deposit slip or bank teller receipt and upload it to cloud object storage.

### Provider Abstraction (`IStorageProvider`)
```typescript
export interface StorageProvider {
  uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string>;
  getPublicUrl(filename: string): Promise<string>;
  deleteFile?(filename: string): Promise<void>;
}
```

### Supabase Storage Adapter Implementation
```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;

  constructor(supabaseUrl: string, supabaseAnonKey: string, bucketName: string) {
    this.client = createClient(supabaseUrl, supabaseAnonKey);
    this.bucket = bucketName;
  }

  async uploadFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const filePath = `receipts/${Date.now()}-${filename}`;
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(filePath, fileBuffer, { contentType: mimeType, upsert: true });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return this.getPublicUrl(filePath);
  }

  async getPublicUrl(filePath: string): Promise<string> {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }
}
```

### Required Environment Variables
* `STORAGE_PROVIDER=supabase`
* `SUPABASE_URL=https://<project-ref>.supabase.co`
* `SUPABASE_ANON_KEY=sb_publishable_...`
* `SUPABASE_BUCKET_NAME=payment-proofs`

---

## 3. Archived Architecture B: Digital Reference Verification via Verify.ET

### Overview
Automated verification against Ethiopian bank transaction feeds using transaction reference IDs (e.g., CBE FT numbers, Telebirr transaction IDs) without requiring image uploads.

### Supported Providers
* `cbe` — Commercial Bank of Ethiopia (FT Reference + Optional Account Suffix)
* `telebirr` — Telebirr / Ethio Telecom (Transaction ID)
* `dashen` — Dashen Bank / Amole
* `boa` — Bank of Abyssinia
* `awash` — Awash International Bank

### Service Implementation
```typescript
export class VerifyEtService {
  private apiKey?: string;
  private baseUrl = "https://api.verify.et/api/v1";

  async verifyTransaction(input: {
    provider: string;
    referenceNumber: string;
    accountSuffix?: string;
    expectedAmount?: number;
  }) {
    if (this.apiKey) {
      const response = await fetch(`${this.baseUrl}/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: input.provider,
          reference: input.referenceNumber,
          account_suffix: input.accountSuffix,
          amount: input.expectedAmount,
        }),
      });
      return await response.json();
    }

    // Sandbox Simulation Mode
    return {
      verified: !input.referenceNumber.startsWith("INVALID"),
      provider: input.provider,
      amount: input.expectedAmount || 25000,
      receiptUrl: `https://verify.et/receipt/${input.referenceNumber}`,
    };
  }
}
```

### Required Environment Variables
* `VERIFY_ET_API_KEY=vet_live_...`

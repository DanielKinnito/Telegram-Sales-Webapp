import type { ResilientNotionClient } from "../notion/notionClient.js";
import { sanitizeTin } from "../common/tinValidator.js";

export interface TinConflictInfo {
  companyName: string;
  ownerName: string;
  assignedDate: string;
  pageId: string;
}

export class TinCache {
  private readonly store: Map<string, TinConflictInfo> = new Map();
  private warmedUp = false;

  public get(tin: string): TinConflictInfo | undefined {
    const cleaned = sanitizeTin(tin);
    return this.store.get(cleaned);
  }

  public has(tin: string): boolean {
    const cleaned = sanitizeTin(tin);
    return this.store.has(cleaned);
  }

  public set(tin: string, info: TinConflictInfo): void {
    const cleaned = sanitizeTin(tin);
    this.store.set(cleaned, info);
  }

  public delete(tin: string): boolean {
    const cleaned = sanitizeTin(tin);
    return this.store.delete(cleaned);
  }

  public clear(): void {
    this.store.clear();
    this.warmedUp = false;
  }

  public isWarmedUp(): boolean {
    return this.warmedUp;
  }

  public size(): number {
    return this.store.size;
  }

  /**
   * Warm up the in-memory cache by reading existing Accounts from Notion.
   * Caches rep page names to minimize requests.
   */
  public async warmup(notionClient: ResilientNotionClient, accountsDbId: string): Promise<void> {
    try {
      const response = (await notionClient.queryDatabase(accountsDbId, {
        page_size: 100,
      })) as { results: any[] };

      const repNameCache: Map<string, string> = new Map();

      for (const page of response.results || []) {
        const props = page.properties;
        const tin = props?.["TIN Number"]?.rich_text?.[0]?.plain_text;
        const companyName = props?.["Company Name"]?.title?.[0]?.plain_text || "Unknown Company";
        const assignedDate = props?.["Assigned Date"]?.date?.start || new Date().toISOString().split("T")[0];

        if (!tin) continue;

        let ownerName = "Sales Rep";
        const ownerRelation = props?.["Owner"]?.relation?.[0]?.id;

        if (ownerRelation) {
          if (repNameCache.has(ownerRelation)) {
            ownerName = repNameCache.get(ownerRelation)!;
          } else {
            try {
              const repPage: any = await notionClient.retrievePage({ page_id: ownerRelation });
              const repProps = repPage?.properties;
              const name = repProps?.["Full Name"]?.rich_text?.[0]?.plain_text ||
                           repProps?.["Name"]?.title?.[0]?.plain_text ||
                           "Sales Rep";
              repNameCache.set(ownerRelation, name);
              ownerName = name;
            } catch {
              // fallback
            }
          }
        }

        this.set(tin, {
          companyName,
          ownerName,
          assignedDate,
          pageId: page.id,
        });
      }

      this.warmedUp = true;
    } catch (err: any) {
      console.warn("TinCache warmup encountered an error:", err.message);
    }
  }
}

let globalTinCacheInstance: TinCache | null = null;

export function getTinCache(): TinCache {
  if (!globalTinCacheInstance) {
    globalTinCacheInstance = new TinCache();
  }
  return globalTinCacheInstance;
}

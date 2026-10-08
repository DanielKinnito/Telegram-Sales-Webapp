import { describe, it, expect, vi, beforeEach } from "vitest";
import { TinCache } from "./tinCache.js";
import type { ResilientNotionClient } from "../notion/notionClient.js";

describe("TinCache", () => {
  let cache: TinCache;
  let mockNotionClient: Partial<ResilientNotionClient>;

  beforeEach(() => {
    mockNotionClient = {
      queryDatabase: vi.fn(),
      retrievePage: vi.fn(),
    };
    cache = new TinCache();
  });

  it("stores and retrieves TIN conflict entries in memory sub-millisecond", () => {
    const conflict = {
      companyName: "Acme Ethiopia",
      ownerName: "John Doe",
      assignedDate: "2026-10-01",
      pageId: "page_acc_1",
    };

    const t0 = performance.now();
    cache.set("0012345678", conflict);
    const retrieved = cache.get("0012345678");
    const elapsed = performance.now() - t0;

    expect(retrieved).toEqual(conflict);
    expect(cache.has("0012345678")).toBe(true);
    expect(cache.has("9999999999")).toBe(false);
    expect(elapsed).toBeLessThan(10); // Well under 100ms
  });

  it("normalizes TINs with whitespace when saving or checking", () => {
    cache.set("  0012345678  ", {
      companyName: "Test Co",
      ownerName: "Sarah",
      assignedDate: "2026-10-02",
      pageId: "page_2",
    });

    expect(cache.has("0012345678")).toBe(true);
    expect(cache.get("0012345678")?.companyName).toBe("Test Co");
  });

  it("warms up cache by querying Accounts DB from Notion", async () => {
    (mockNotionClient.queryDatabase as any).mockResolvedValue({
      results: [
        {
          id: "page_acc_101",
          properties: {
            "Company Name": {
              title: [{ plain_text: "Alpha Logistics" }],
            },
            "TIN Number": {
              rich_text: [{ plain_text: "1122334455" }],
            },
            "Assigned Date": {
              date: { start: "2026-09-15" },
            },
            "Owner": {
              relation: [{ id: "rep_page_1" }],
            },
          },
        },
      ],
    });

    // Mock rep page retrieval for owner name
    (mockNotionClient.retrievePage as any).mockResolvedValue({
      id: "rep_page_1",
      properties: {
        "Full Name": {
          rich_text: [{ plain_text: "Michael Scott" }],
        },
      },
    });

    await cache.warmup(mockNotionClient as ResilientNotionClient, "acc_db_id");

    expect(cache.has("1122334455")).toBe(true);
    const entry = cache.get("1122334455");
    expect(entry?.companyName).toBe("Alpha Logistics");
    expect(entry?.ownerName).toBe("Michael Scott");
    expect(entry?.assignedDate).toBe("2026-09-15");
  });
});

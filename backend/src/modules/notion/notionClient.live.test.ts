import { describe, it, expect } from "vitest";
import { getNotionClient } from "./notionClient.js";
import { env } from "../../config/env.js";

describe("Live Notion Integration Verification", () => {
  it("successfully queries Notion metadata for Accounts DB", async () => {
    const client = getNotionClient();
    const db = await client.retrieveDatabase({
      database_id: env.NOTION_ACCOUNTS_DB_ID,
    });
    expect(db.id.replace(/-/g, "")).toBe(env.NOTION_ACCOUNTS_DB_ID.replace(/-/g, ""));
  }, 15000);
});

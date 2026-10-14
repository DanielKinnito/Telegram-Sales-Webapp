import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const client = getNotionClient();
  const parentId = process.env.NOTION_PARENT_PAGE_ID!;

  console.log("Testing link_to_page and clickable links...");

  // Try appending a link_to_page block
  try {
    const res = await (client.rawClient as any).blocks.children.append({
      block_id: parentId,
      children: [
        {
          type: "link_to_page",
          link_to_page: {
            type: "database_id",
            database_id: env.NOTION_DEALS_DB_ID,
          },
        },
      ],
    });
    console.log("link_to_page succeeded!", res.results[0]);
    // Clean it up immediately after test
    await (client.rawClient as any).blocks.delete({ block_id: res.results[0].id });
  } catch (err: any) {
    console.log("link_to_page failed:", err.message);
  }
}

main().catch(console.error);

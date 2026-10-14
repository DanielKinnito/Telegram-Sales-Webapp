import { getNotionClient } from "../src/modules/notion/notionClient.js";

async function main() {
  const client = getNotionClient();
  const parentId = process.env.NOTION_PARENT_PAGE_ID!;

  const blocks: any = await (client.rawClient as any).blocks.children.list({ block_id: parentId });
  console.log("Blocks on parent page:");
  blocks.results.forEach((b: any, index: number) => {
    console.log(`${index}: [${b.type}] id: ${b.id}`);
  });
}

main().catch(console.error);

import { getNotionClient } from "../src/modules/notion/notionClient.js";

async function main() {
  const client = getNotionClient();
  const colListId = "3f9d691d-57eb-814e-b015-fcf92939f5c5";
  const cols: any = await (client.rawClient as any).blocks.children.list({ block_id: colListId });
  console.log("Columns count:", cols.results.length);
  for (const c of cols.results) {
    const children: any = await (client.rawClient as any).blocks.children.list({ block_id: c.id });
    console.log("Column block count:", children.results.length);
    for (const ch of children.results) {
      if (ch.type === "callout") {
        console.log("  Callout icon:", ch.callout?.icon?.emoji);
        console.log("  Callout links:", ch.callout?.rich_text?.map((r: any) => ({ text: r.plain_text.trim(), link: r.href || r.text?.link })));
      } else if (ch.type === "link_to_page") {
        console.log("  link_to_page target:", ch.link_to_page);
      }
    }
  }
}

main().catch(console.error);

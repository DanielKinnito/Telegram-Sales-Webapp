import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const notion = getNotionClient();
  const dsId = await notion.getDataSourceId(env.NOTION_SALES_REPS_DB_ID);
  console.log("Sales Reps Data Source ID:", dsId);

  // 1. Add "Telegram User ID" rich_text property if not present
  try {
    await (notion.rawClient as any).dataSources.update({
      data_source_id: dsId,
      properties: {
        "Telegram User ID": {
          rich_text: {},
        },
      },
    });
    console.log("Added 'Telegram User ID' property to Sales Reps data source.");
  } catch (err: any) {
    console.log("Property might already exist or update via databases:", err.message);
  }

  // 2. Fetch all reps and update them
  const res = (await notion.queryDatabase(env.NOTION_SALES_REPS_DB_ID, {})) as any;
  for (const page of res.results) {
    const tid = page.properties["Telegram ID"]?.title?.[0]?.plain_text || page.properties["Name"]?.title?.[0]?.plain_text || "";
    const fullName = page.properties["Full Name"]?.rich_text?.[0]?.plain_text || tid;

    console.log(`Updating ${page.id}: Setting Title to "${fullName}", Telegram User ID to "${tid}"`);

    await notion.updatePage({
      page_id: page.id,
      properties: {
        "Telegram ID": {
          title: [{ text: { content: fullName } }],
        },
        "Telegram User ID": {
          rich_text: [{ text: { content: tid } }],
        },
      },
    });
  }

  console.log("✅ Successfully updated all Sales Reps pages!");
}

main().catch(console.error);

import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const client = getNotionClient();
  const parentId = process.env.NOTION_PARENT_PAGE_ID!;

  console.log("Re-ordering dashboard blocks to place cards at the TOP of the Notion page...");

  // 1. Get current blocks
  const blocksRes: any = await (client.rawClient as any).blocks.children.list({ block_id: parentId });
  const blocks = blocksRes.results;

  // Identify blocks 8 through 16 to delete
  for (let i = 8; i < blocks.length; i++) {
    try {
      await (client.rawClient as any).blocks.delete({ block_id: blocks[i].id });
      console.log(`Deleted block ${blocks[i].id}`);
    } catch (e: any) {
      console.warn(`Could not delete block:`, e.message);
    }
  }

  // 2. Fetch counts for badges
  let dealsCount = 0;
  let accountsCount = 0;
  let repsCount = 0;
  let logsCount = 0;

  try {
    const dealsDs = await client.getDataSourceId(env.NOTION_DEALS_DB_ID);
    const dRes = await client.queryDataSource({ data_source_id: dealsDs });
    dealsCount = dRes.results.length;

    const accDs = await client.getDataSourceId(env.NOTION_ACCOUNTS_DB_ID);
    const aRes = await client.queryDataSource({ data_source_id: accDs });
    accountsCount = aRes.results.length;

    const repDs = await client.getDataSourceId(env.NOTION_SALES_REPS_DB_ID);
    const rRes = await client.queryDataSource({ data_source_id: repDs });
    repsCount = rRes.results.length;

    const logDs = await client.getDataSourceId(env.NOTION_SALES_LOGS_DB_ID);
    const lRes = await client.queryDataSource({ data_source_id: logDs });
    logsCount = lRes.results.length;
  } catch {}

  // 3. Construct modern cards
  const topBlocks: any[] = [
    // Welcome Callout Banner
    {
      type: "callout",
      callout: {
        rich_text: [
          {
            type: "text",
            text: { content: "⚡ Sales CRM Command Center\n" },
            annotations: { bold: true, color: "default" },
          },
          {
            type: "text",
            text: {
              content:
                "Real-time relational datastore integrated with Telegram Mini App & Ethiopian TIN Conflict Engine. Tap any card below to inspect records.",
            },
            annotations: { italic: true, color: "gray" },
          },
        ],
        icon: { type: "emoji", emoji: "🚀" },
        color: "blue_background",
      },
    },

    // Spacer
    { type: "paragraph", paragraph: { rich_text: [] } },

    // Section 1: Dashboard Navigation
    {
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: { content: "📱 Quick Navigation Cards" },
            annotations: { bold: true },
          },
        ],
      },
    },
    { type: "divider", divider: {} },

    // Row 1: 3 Columns of Cards (Work / School / Personal style from Screenshot 4)
    {
      type: "column_list",
      column_list: {
        children: [
          // Card 1: Deals & Pipeline (Blue / Work)
          {
            type: "column",
            column: {
              children: [
                {
                  type: "callout",
                  callout: {
                    rich_text: [
                      {
                        type: "text",
                        text: { content: "Deals & Pipeline\n" },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${dealsCount} active deals\n` },
                        annotations: { color: "blue", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Offers, generator quotes & won deals" },
                        annotations: { italic: true, color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "💼" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },
          // Card 2: Accounts & Clients (Teal / School)
          {
            type: "column",
            column: {
              children: [
                {
                  type: "callout",
                  callout: {
                    rich_text: [
                      {
                        type: "text",
                        text: { content: "Accounts & Clients\n" },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${accountsCount} registered companies\n` },
                        annotations: { color: "purple", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Verified Ethiopian TINs & owners" },
                        annotations: { italic: true, color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🏢" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },
          // Card 3: Sales Representatives (Purple / Personal)
          {
            type: "column",
            column: {
              children: [
                {
                  type: "callout",
                  callout: {
                    rich_text: [
                      {
                        type: "text",
                        text: { content: "Sales Team\n" },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${repsCount} active members\n` },
                        annotations: { color: "green", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Sales reps, front desk & managers" },
                        annotations: { italic: true, color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "👥" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },
        ],
      },
    },

    // Row 2: 3 Columns of Cards (Projects / Wiki / Docs style from Screenshot 4)
    {
      type: "column_list",
      column_list: {
        children: [
          // Card 4: Sales Logs (Orange / Projects)
          {
            type: "column",
            column: {
              children: [
                {
                  type: "callout",
                  callout: {
                    rich_text: [
                      {
                        type: "text",
                        text: { content: "Activity Logs\n" },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${logsCount} activity logs\n` },
                        annotations: { color: "orange", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Meeting notes & scheduled calls" },
                        annotations: { italic: true, color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📝" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },
          // Card 5: Rotational Queue (Red / Wiki)
          {
            type: "column",
            column: {
              children: [
                {
                  type: "callout",
                  callout: {
                    rich_text: [
                      {
                        type: "text",
                        text: { content: "Rotational Queue\n" },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Front desk engine\n" },
                        annotations: { color: "red", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Automated round-robin distribution" },
                        annotations: { italic: true, color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🛎️" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },
          // Card 6: Contacts Directory (Yellow / Docs)
          {
            type: "column",
            column: {
              children: [
                {
                  type: "callout",
                  callout: {
                    rich_text: [
                      {
                        type: "text",
                        text: { content: "Contacts Directory\n" },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Stakeholder phonebook\n" },
                        annotations: { color: "yellow", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Key contacts & commission beneficiaries" },
                        annotations: { italic: true, color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📱" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },
        ],
      },
    },

    // Spacer
    { type: "paragraph", paragraph: { rich_text: [] } },

    // Section 2: Databases
    {
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: { content: "🗄️ Relational Databases & Datastores" },
            annotations: { bold: true },
          },
        ],
      },
    },
    { type: "divider", divider: {} },
  ];

  // Insert before the databases (after block 0)
  const topBlockId = blocks[0].id;
  await (client.rawClient as any).blocks.children.append({
    block_id: parentId,
    after: topBlockId,
    children: topBlocks,
  });

  console.log("🎉 Successfully positioned aesthetic cards and dashboard at the TOP of the Notion page!");
}

main().catch(console.error);

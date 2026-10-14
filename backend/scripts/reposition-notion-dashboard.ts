import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const client = getNotionClient();
  const parentId = process.env.NOTION_PARENT_PAGE_ID!;

  console.log("Upgrading dashboard cards with direct CLICKABLE links to all tables...");

  // 1. Fetch current blocks on parent page
  const blocksRes: any = await (client.rawClient as any).blocks.children.list({ block_id: parentId });
  const blocks = blocksRes.results;

  // Blocks 1 to 9 are the dashboard blocks we created earlier. Delete them to replace with 100% clickable cards.
  for (let i = 1; i <= 9; i++) {
    if (blocks[i] && blocks[i].type !== "child_database") {
      try {
        await (client.rawClient as any).blocks.delete({ block_id: blocks[i].id });
        console.log(`Removed previous block ${blocks[i].id} (${blocks[i].type})`);
      } catch (err: any) {
        console.warn(`Could not delete block:`, err.message);
      }
    }
  }

  // 2. Fetch live counts
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

  const dealsUrl = `https://www.notion.so/${env.NOTION_DEALS_DB_ID.replace(/-/g, "")}`;
  const accountsUrl = `https://www.notion.so/${env.NOTION_ACCOUNTS_DB_ID.replace(/-/g, "")}`;
  const repsUrl = `https://www.notion.so/${env.NOTION_SALES_REPS_DB_ID.replace(/-/g, "")}`;
  const logsUrl = `https://www.notion.so/${env.NOTION_SALES_LOGS_DB_ID.replace(/-/g, "")}`;
  const queueUrl = `https://www.notion.so/${env.NOTION_QUEUE_DB_ID.replace(/-/g, "")}`;
  const contactsUrl = `https://www.notion.so/${env.NOTION_CONTACTS_DB_ID.replace(/-/g, "")}`;

  // 3. Build fully clickable cards & link_to_page components
  const clickableDashboardBlocks: any[] = [
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
                "Click on any of the cards below to jump directly into the full database table view with all columns, filters, and records.",
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

    // Section Title
    {
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: { content: "📱 Quick Navigation Cards (Click to Open)" },
            annotations: { bold: true },
          },
        ],
      },
    },
    { type: "divider", divider: {} },

    // Row 1: 3 Columns with clickable cards & native Notion link_to_page blocks
    {
      type: "column_list",
      column_list: {
        children: [
          // Column 1: Deals & Pipeline
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
                        text: { content: "Deals & Pipeline\n", link: { url: dealsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${dealsCount} active deals\n`, link: { url: dealsUrl } },
                        annotations: { color: "blue", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "↗ Open Deals Table", link: { url: dealsUrl } },
                        annotations: { underline: true, color: "blue", bold: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "💼" },
                    color: "gray_background",
                  },
                },
                {
                  type: "link_to_page",
                  link_to_page: {
                    type: "database_id",
                    database_id: env.NOTION_DEALS_DB_ID,
                  },
                },
              ],
            },
          },

          // Column 2: Accounts & Clients
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
                        text: { content: "Accounts & Clients\n", link: { url: accountsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${accountsCount} registered companies\n`, link: { url: accountsUrl } },
                        annotations: { color: "purple", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "↗ Open Accounts Table", link: { url: accountsUrl } },
                        annotations: { underline: true, color: "purple", bold: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🏢" },
                    color: "gray_background",
                  },
                },
                {
                  type: "link_to_page",
                  link_to_page: {
                    type: "database_id",
                    database_id: env.NOTION_ACCOUNTS_DB_ID,
                  },
                },
              ],
            },
          },

          // Column 3: Sales Representatives
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
                        text: { content: "Sales Team\n", link: { url: repsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${repsCount} active members\n`, link: { url: repsUrl } },
                        annotations: { color: "green", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "↗ Open Sales Reps Table", link: { url: repsUrl } },
                        annotations: { underline: true, color: "green", bold: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "👥" },
                    color: "gray_background",
                  },
                },
                {
                  type: "link_to_page",
                  link_to_page: {
                    type: "database_id",
                    database_id: env.NOTION_SALES_REPS_DB_ID,
                  },
                },
              ],
            },
          },
        ],
      },
    },

    // Row 2: 3 Columns with clickable cards & native Notion link_to_page blocks
    {
      type: "column_list",
      column_list: {
        children: [
          // Column 4: Sales Activity Logs
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
                        text: { content: "Activity Logs\n", link: { url: logsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${logsCount} activity logs\n`, link: { url: logsUrl } },
                        annotations: { color: "orange", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "↗ Open Activity Logs Table", link: { url: logsUrl } },
                        annotations: { underline: true, color: "orange", bold: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📝" },
                    color: "gray_background",
                  },
                },
                {
                  type: "link_to_page",
                  link_to_page: {
                    type: "database_id",
                    database_id: env.NOTION_SALES_LOGS_DB_ID,
                  },
                },
              ],
            },
          },

          // Column 5: Rotational Walk-in Queue
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
                        text: { content: "Rotational Queue\n", link: { url: queueUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Front desk engine\n", link: { url: queueUrl } },
                        annotations: { color: "red", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "↗ Open Queue Table", link: { url: queueUrl } },
                        annotations: { underline: true, color: "red", bold: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🛎️" },
                    color: "gray_background",
                  },
                },
                {
                  type: "link_to_page",
                  link_to_page: {
                    type: "database_id",
                    database_id: env.NOTION_QUEUE_DB_ID,
                  },
                },
              ],
            },
          },

          // Column 6: Contacts Directory
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
                        text: { content: "Contacts & Brokers\n", link: { url: contactsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Key stakeholders\n", link: { url: contactsUrl } },
                        annotations: { color: "yellow", bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "↗ Open Contacts Table", link: { url: contactsUrl } },
                        annotations: { underline: true, color: "yellow", bold: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📱" },
                    color: "gray_background",
                  },
                },
                {
                  type: "link_to_page",
                  link_to_page: {
                    type: "database_id",
                    database_id: env.NOTION_CONTACTS_DB_ID,
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

    // Section 2 Header: Databases
    {
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: { content: "🗄️ Relational CRM Databases" },
            annotations: { bold: true },
          },
        ],
      },
    },
    { type: "divider", divider: {} },
  ];

  // Append right after the very first paragraph block
  const topBlockId = blocks[0].id;
  await (client.rawClient as any).blocks.children.append({
    block_id: parentId,
    after: topBlockId,
    children: clickableDashboardBlocks,
  });

  console.log("🎉 Successfully added 100% clickable navigation cards and link_to_page blocks to Notion!");
}

main().catch(console.error);

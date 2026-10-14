import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const client = getNotionClient();
  const parentId = env.NOTION_PARENT_PAGE_ID;

  console.log("Repositioning modern cards grid directly to the top of Notion page...");

  // 1. Fetch current blocks on parent page
  const blocksRes: any = await (client.rawClient as any).blocks.children.list({ block_id: parentId });
  const blocks: any[] = blocksRes.results;

  // Delete all non-child_database blocks
  let firstBlockId: string | null = null;
  for (const block of blocks) {
    if (block.type !== "child_database") {
      try {
        await (client.rawClient as any).blocks.delete({ block_id: block.id });
        console.log(`Deleted block ${block.id} (${block.type})`);
      } catch (err: any) {
        console.warn(`Could not delete block:`, err.message);
      }
    }
  }

  // 2. Fetch live record counts
  let dealsCount = 0;
  let accountsCount = 0;
  let repsCount = 0;
  let logsCount = 0;
  let queueCount = 0;
  let contactsCount = 0;

  try {
    const dealsRes: any = await client.queryDatabase(env.NOTION_DEALS_DB_ID, {});
    dealsCount = dealsRes.results?.length || 0;

    const accountsRes: any = await client.queryDatabase(env.NOTION_ACCOUNTS_DB_ID, {});
    accountsCount = accountsRes.results?.length || 0;

    const repsRes: any = await client.queryDatabase(env.NOTION_SALES_REPS_DB_ID, {});
    repsCount = repsRes.results?.length || 0;

    const logsRes: any = await client.queryDatabase(env.NOTION_SALES_LOGS_DB_ID, {});
    logsCount = logsRes.results?.length || 0;

    const queueRes: any = await client.queryDatabase(env.NOTION_QUEUE_DB_ID, {});
    queueCount = queueRes.results?.length || 0;

    const contactsRes: any = await client.queryDatabase(env.NOTION_CONTACTS_DB_ID, {});
    contactsCount = contactsRes.results?.length || 0;
  } catch (err: any) {
    console.warn("Could not fetch counts:", err.message);
  }

  const dealsUrl = `https://www.notion.so/${env.NOTION_DEALS_DB_ID.replace(/-/g, "")}`;
  const accountsUrl = `https://www.notion.so/${env.NOTION_ACCOUNTS_DB_ID.replace(/-/g, "")}`;
  const repsUrl = `https://www.notion.so/${env.NOTION_SALES_REPS_DB_ID.replace(/-/g, "")}`;
  const logsUrl = `https://www.notion.so/${env.NOTION_SALES_LOGS_DB_ID.replace(/-/g, "")}`;
  const queueUrl = `https://www.notion.so/${env.NOTION_QUEUE_DB_ID.replace(/-/g, "")}`;
  const contactsUrl = `https://www.notion.so/${env.NOTION_CONTACTS_DB_ID.replace(/-/g, "")}`;

  // 3. Build sleek modern card grid
  const modernBlocks: any[] = [
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

    // Row 1: 3 Columns (Deals, Accounts, Sales Team)
    {
      type: "column_list",
      column_list: {
        children: [
          // Deals Card
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
                        annotations: { color: "blue", underline: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "💼" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Accounts Card
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
                        annotations: { color: "purple", underline: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🏢" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Sales Reps Card
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
                        annotations: { color: "green", underline: true },
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

    // Row 2: 3 Columns (Activity Logs, Rotational Queue, Contacts)
    {
      type: "column_list",
      column_list: {
        children: [
          // Activity Logs Card
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
                        annotations: { color: "orange", underline: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📝" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Rotational Queue Card
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
                        annotations: { color: "red", underline: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🔔" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Contacts & Brokers Card
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
                        annotations: { color: "yellow", underline: true },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📇" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },
        ],
      },
    },
    { type: "divider", divider: {} },
  ];

  // Insert at top: in Notion, if child databases exist, we can create a temporary paragraph at the top or append after null
  // In Notion API, if after is omitted, it appends to the end. But Notion parent page can also have a top block.
  // Let's create the top blocks.
  const appendRes = await (client.rawClient as any).blocks.children.append({
    block_id: parentId,
    children: modernBlocks,
  });

  console.log("✅ Successfully updated Notion page with sleek modern card grid!");
}

main().catch(console.error);

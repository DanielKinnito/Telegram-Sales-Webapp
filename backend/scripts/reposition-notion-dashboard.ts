import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const client = getNotionClient();
  const parentId = env.NOTION_PARENT_PAGE_ID;

  // 1. Fetch current blocks on parent page
  const blocksRes: any = await (client.rawClient as any).blocks.children.list({ block_id: parentId });
  const blocks: any[] = blocksRes.results;

  // Delete all non-child_database blocks
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

  // 2. Fetch record counts
  let dealsCount = 0;
  let accountsCount = 0;
  let repsCount = 0;
  let logsCount = 0;
  let queueCount = 0;
  let contactsCount = 0;
  let reportsCount = 0;

  const reportsDbId = env.NOTION_REPORTS_DB_ID || "4d04d701-bbf7-4797-951c-5fc010720939";

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

    const reportsRes: any = await client.queryDatabase(reportsDbId, {});
    reportsCount = reportsRes.results?.length || 0;
  } catch (err: any) {
    console.warn("Could not fetch counts:", err.message);
  }

  const dealsUrl = `https://www.notion.so/${env.NOTION_DEALS_DB_ID.replace(/-/g, "")}`;
  const accountsUrl = `https://www.notion.so/${env.NOTION_ACCOUNTS_DB_ID.replace(/-/g, "")}`;
  const repsUrl = `https://www.notion.so/${env.NOTION_SALES_REPS_DB_ID.replace(/-/g, "")}`;
  const logsUrl = `https://www.notion.so/${env.NOTION_SALES_LOGS_DB_ID.replace(/-/g, "")}`;
  const queueUrl = `https://www.notion.so/${env.NOTION_QUEUE_DB_ID.replace(/-/g, "")}`;
  const contactsUrl = `https://www.notion.so/${env.NOTION_CONTACTS_DB_ID.replace(/-/g, "")}`;
  const reportsUrl = `https://www.notion.so/${reportsDbId.replace(/-/g, "")}`;

  // 3. Build MINIMAL cards matching clean executive standard:
  // ONLY Title and Count, ZERO description words, ZERO "↗ Open Table" buttons
  const cleanBlocks: any[] = [
    // Row 1: 4 Columns (Deals, Accounts, Sales Reps, Executive Reports)
    {
      type: "column_list",
      column_list: {
        children: [
          // Deals
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
                        text: { content: `${dealsCount} active deals`, link: { url: dealsUrl } },
                        annotations: { color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "💼" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Accounts
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
                        text: { content: "Accounts\n", link: { url: accountsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${accountsCount} accounts`, link: { url: accountsUrl } },
                        annotations: { color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🏢" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Sales Reps
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
                        text: { content: "Sales Reps\n", link: { url: repsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${repsCount} members`, link: { url: repsUrl } },
                        annotations: { color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "👥" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Executive Reports
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
                        text: { content: "Executive Reports\n", link: { url: reportsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${reportsCount} published`, link: { url: reportsUrl } },
                        annotations: { color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📊" },
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
          // Activity Logs
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
                        text: { content: `${logsCount} logs`, link: { url: logsUrl } },
                        annotations: { color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "📝" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Rotational Queue
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
                        text: { content: `${queueCount} in queue`, link: { url: queueUrl } },
                        annotations: { color: "gray" },
                      },
                    ],
                    icon: { type: "emoji", emoji: "🔔" },
                    color: "gray_background",
                  },
                },
              ],
            },
          },

          // Contacts
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
                        text: { content: "Contacts\n", link: { url: contactsUrl } },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: `${contactsCount} contacts`, link: { url: contactsUrl } },
                        annotations: { color: "gray" },
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
  ];

  await (client.rawClient as any).blocks.children.append({
    block_id: parentId,
    children: cleanBlocks,
  });

  console.log("✅ Successfully updated Notion page with Executive Reports card included!");
}

main().catch(console.error);

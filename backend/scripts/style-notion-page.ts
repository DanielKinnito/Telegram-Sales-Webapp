import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const client = getNotionClient();
  const parentId = process.env.NOTION_PARENT_PAGE_ID;

  if (!parentId) {
    console.error("No NOTION_PARENT_PAGE_ID defined in environment.");
    return;
  }

  console.log("🎨 Elevating Notion Workspace & Parent Page Design...");

  // 1. Update Parent Page Icon, Cover, and Title
  console.log("1️⃣ Setting luxury cover, icon, and title on Parent Page...");
  await (client.rawClient as any).pages.update({
    page_id: parentId,
    icon: {
      type: "emoji",
      emoji: "⚡",
    },
    cover: {
      type: "external",
      external: {
        // High-res Apple-style dark iridescent abstract art
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop",
      },
    },
  });

  // 2. Set database icons on each child database
  console.log("2️⃣ Adding customized icons & descriptions to all CRM databases...");
  const dbIcons: { id: string; emoji: string; name: string }[] = [
    { id: env.NOTION_DEALS_DB_ID, emoji: "📊", name: "Deals & Pipeline" },
    { id: env.NOTION_ACCOUNTS_DB_ID, emoji: "🏢", name: "Accounts & Clients" },
    { id: env.NOTION_SALES_REPS_DB_ID, emoji: "👥", name: "Sales Representatives" },
    { id: env.NOTION_CONTACTS_DB_ID, emoji: "📱", name: "Contacts Directory" },
    { id: env.NOTION_SALES_LOGS_DB_ID, emoji: "📝", name: "Sales Activity Logs" },
    { id: env.NOTION_QUEUE_DB_ID, emoji: "🛎️", name: "Rotational Walk-in Queue" },
  ];

  for (const item of dbIcons) {
    try {
      const dsId = await client.getDataSourceId(item.id);
      // Try updating database icon
      await (client.rawClient as any).databases.update({
        database_id: item.id,
        icon: { type: "emoji", emoji: item.emoji },
      });
      console.log(`  ✓ Updated icon for ${item.name} (${item.emoji})`);
    } catch (err: any) {
      // Fallback: update via dataSource or ignore if unsupported
      try {
        await (client.rawClient as any).dataSources.update({
          data_source_id: item.id,
          icon: { type: "emoji", emoji: item.emoji },
        });
        console.log(`  ✓ Updated dataSource icon for ${item.name}`);
      } catch (e2: any) {
        console.log(`  ℹ Note: icon update on ${item.name} skipped:`, err.message);
      }
    }
  }

  // 3. Inspect existing blocks on the parent page
  console.log("3️⃣ Inspecting existing blocks on parent page...");
  const existingBlocks: any = await (client.rawClient as any).blocks.children.list({
    block_id: parentId,
  });

  // Check if we already appended our navigation deck
  const alreadyStyled = existingBlocks.results.some((b: any) =>
    b.type === "heading_2" && b.heading_2?.rich_text?.[0]?.plain_text?.includes("Navigation")
  );

  if (alreadyStyled) {
    console.log("✨ Parent page is already styled with modern navigation cards!");
    return;
  }

  // 4. Create Screenshot 4 style Navigation Cards & Header Deck
  console.log("4️⃣ Building Screenshot-4 aesthetic dashboard cards & workspace deck...");

  // Get current counts for dynamic badges
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
  } catch (cntErr) {
    // fallback defaults
  }

  const newBlocks: any[] = [
    // Welcome Callout Banner
    {
      type: "callout",
      callout: {
        rich_text: [
          {
            type: "text",
            text: { content: "⚡ Welcome to the Sales CRM Hub\n" },
            annotations: { bold: true, color: "default" },
          },
          {
            type: "text",
            text: {
              content:
                "Centralized relational command center synced real-time with the Telegram Sales Mini App and Ethiopian TIN verification engine. Use the cards below for quick access.",
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
            text: { content: "📱 Quick Access Dashboard" },
            annotations: { bold: true },
          },
        ],
      },
    },

    // Divider
    { type: "divider", divider: {} },

    // Row 1: 3 Columns of Cards (Work / Personal / Projects style from Screenshot 4)
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
                        annotations: { color: "gray" },
                      },
                      {
                        type: "text",
                        text: { content: "Proposals, equipment offers & won sales" },
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
                        annotations: { color: "gray" },
                      },
                      {
                        type: "text",
                        text: { content: "Verified Ethiopian TINs & ownership" },
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
                        annotations: { color: "gray" },
                      },
                      {
                        type: "text",
                        text: { content: "Reps, front desk & executive managers" },
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
                        text: { content: `${logsCount} timeline updates\n` },
                        annotations: { color: "gray" },
                      },
                      {
                        type: "text",
                        text: { content: "Client meetings, notes & call reminders" },
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
                        annotations: { color: "gray" },
                      },
                      {
                        type: "text",
                        text: { content: "Automated round-robin walk-in leads" },
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
                        text: { content: "Contacts & Brokers\n" },
                        annotations: { bold: true },
                      },
                      {
                        type: "text",
                        text: { content: "Key stakeholders\n" },
                        annotations: { color: "gray" },
                      },
                      {
                        type: "text",
                        text: { content: "Decision makers & commission beneficiaries" },
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

    // Section 2 Header: Databases
    {
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: { content: "🗄️ Relational Datastores" },
            annotations: { bold: true },
          },
        ],
      },
    },
    { type: "divider", divider: {} },
  ];

  // Insert the blocks onto the parent page
  const appended = await (client.rawClient as any).blocks.children.append({
    block_id: parentId,
    children: newBlocks,
  });

  console.log(`✅ Successfully added ${appended.results.length} layout blocks to parent page!`);
}

main().catch(console.error);

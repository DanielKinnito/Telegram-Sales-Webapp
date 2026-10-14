import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function main() {
  const client = getNotionClient();
  const dsId = await client.getDataSourceId(env.NOTION_DEALS_DB_ID);
  const ds: any = await (client.rawClient as any).dataSources.retrieve({ data_source_id: dsId });
  
  console.log("STAGE PROPERTY DETAILS:");
  console.log(JSON.stringify(ds.properties?.["Stage"], null, 2));

  // Check if we need to add 'Product Type', 'Offer VAT Incl', 'Lost Reason'
  const props = ds.properties || {};
  const updates: Record<string, any> = {};

  if (!props["Product Type"]) {
    updates["Product Type"] = { rich_text: {} };
  }
  if (!props["Offer VAT Incl"]) {
    updates["Offer VAT Incl"] = { number: { format: "number" } };
  }
  if (!props["Lost Reason"]) {
    updates["Lost Reason"] = { rich_text: {} };
  }

  // Also ensure Stage options include 'Lost'
  const stageOptions = ds.properties?.["Stage"]?.select?.options || [];
  const hasLost = stageOptions.some((o: any) => o.name.toLowerCase() === "lost");
  if (!hasLost) {
    updates["Stage"] = {
      select: {
        options: [...stageOptions, { name: "Lost", color: "red" }],
      },
    };
  }

  if (Object.keys(updates).length > 0) {
    console.log("Updating Notion Deals DB with properties:", Object.keys(updates));
    const res = await (client.rawClient as any).dataSources.update({
      data_source_id: dsId,
      properties: updates,
    });
    console.log("Successfully updated Deals DB schema!");
  } else {
    console.log("Deals DB already has all required properties and Lost stage option!");
  }
}

main().catch(console.error);

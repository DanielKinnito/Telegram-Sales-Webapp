import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { env } from "../src/config/env.js";

async function getDataSourceId(client: any, databaseId: string): Promise<string> {
  const db: any = await client.retrieveDatabase({ database_id: databaseId });
  const dsId = db.data_sources?.[0]?.id;
  if (!dsId) throw new Error(`No data source found for database ${databaseId}`);
  return dsId;
}

async function main() {
  const client = getNotionClient();

  console.log("🛠️  Syncing remaining Notion Database schemas to Notion Data Sources...");

  // 1. Deals DB
  const dealsDsId = await getDataSourceId(client, env.NOTION_DEALS_DB_ID);
  console.log("Updating Deals Data Source:", dealsDsId);
  await client.rawClient.dataSources.update({
    data_source_id: dealsDsId,
    properties: {
      "Name": { name: "Deal Title" },
      "Stage": {
        select: {
          options: [
            { name: "New", color: "blue" },
            { name: "Contacted", color: "yellow" },
            { name: "Proposal", color: "purple" },
            { name: "Payment Pending Verification", color: "orange" },
            { name: "Won", color: "green" },
            { name: "Lost", color: "red" },
          ],
        },
      },
      "Amount": { number: { format: "number_with_commas" } },
      "Deposit Ref #": { rich_text: {} },
      "Payment Proof URL": { url: {} },
    },
  });

  // 2. Contacts DB
  const contactsDsId = await getDataSourceId(client, env.NOTION_CONTACTS_DB_ID);
  console.log("Updating Contacts Data Source:", contactsDsId);
  await client.rawClient.dataSources.update({
    data_source_id: contactsDsId,
    properties: {
      "Name": { name: "Contact Name" },
      "Phone": { phone_number: {} },
      "Email": { email: {} },
      "Position": { rich_text: {} },
      "Primary Contact Flag": { checkbox: {} },
    },
  });

  // 3. Sales Logs DB
  const salesLogsDsId = await getDataSourceId(client, env.NOTION_SALES_LOGS_DB_ID);
  console.log("Updating Sales Logs Data Source:", salesLogsDsId);
  await client.rawClient.dataSources.update({
    data_source_id: salesLogsDsId,
    properties: {
      "Name": { name: "Log Title / ID" },
      "Interaction Type": {
        select: {
          options: [
            { name: "Call", color: "blue" },
            { name: "Meeting", color: "green" },
            { name: "Note", color: "gray" },
          ],
        },
      },
      "Activity Date": { date: {} },
      "Note Content": { rich_text: {} },
      "Location": { rich_text: {} },
    },
  });

  // 4. Rotational Queue DB
  const queueDsId = await getDataSourceId(client, env.NOTION_QUEUE_DB_ID);
  console.log("Updating Rotational Queue Data Source:", queueDsId);
  await client.rawClient.dataSources.update({
    data_source_id: queueDsId,
    properties: {
      "Name": { name: "Rep ID" },
      "Order Position": { number: { format: "number" } },
      "Availability Status": {
        select: {
          options: [
            { name: "Available", color: "green" },
            { name: "Busy", color: "yellow" },
            { name: "Offline", color: "red" },
          ],
        },
      },
      "Last Assigned Timestamp": { date: {} },
    },
  });

  console.log("✅ All Notion Database schemas successfully provisioned in live Notion!");
}

main().catch(console.error);

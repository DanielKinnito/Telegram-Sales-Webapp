import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function extractNotionId(rawInput?: string): string | null {
  if (!rawInput) return null;
  const cleaned = rawInput.trim();
  // Extract 32-char hex string from URL or raw ID
  const match = cleaned.match(/([a-f0-9]{32})/i) || cleaned.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  return match ? match[1].replace(/-/g, "") : null;
}

const rawParent = process.env.NOTION_PARENT_PAGE_ID;
const parentPageId = extractNotionId(rawParent);

if (!parentPageId || !process.env.NOTION_API_KEY) {
  console.error("❌ Missing valid NOTION_API_KEY or NOTION_PARENT_PAGE_ID in .env");
  console.error(`Received Parent ID value: "${rawParent}"`);
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function run() {
  console.log(`🚀 Starting Notion CRM database provisioning under page ID: ${parentPageId}...`);

  // PHASE 1: Create base databases
  console.log("📦 Creating base databases...");

  const salesRepsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Sales Reps" } }],
    properties: {
      "Telegram ID": { title: {} },
      "Full Name": { rich_text: {} },
      "Phone": { phone_number: {} },
      "Status": {
        select: {
          options: [
            { name: "Active", color: "green" },
            { name: "Pending Approval", color: "yellow" },
            { name: "Inactive", color: "red" }
          ]
        }
      },
      "Total Sales Count": { number: { format: "number" } }
    }
  });

  const accountsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Accounts" } }],
    properties: {
      "Company Name": { title: {} },
      "TIN Number": { rich_text: {} },
      "Address": { rich_text: {} },
      "Industry": {
        select: {
          options: [
            { name: "Technology", color: "blue" },
            { name: "Retail", color: "orange" },
            { name: "Manufacturing", color: "brown" },
            { name: "Services", color: "purple" }
          ]
        }
      },
      "Assigned Date": { date: {} }
    }
  });

  const dealsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Deals / Pipeline" } }],
    properties: {
      "Deal Title": { title: {} },
      "Stage": {
        select: {
          options: [
            { name: "New", color: "gray" },
            { name: "Contacted", color: "blue" },
            { name: "Proposal", color: "yellow" },
            { name: "Payment Pending Verification", color: "orange" },
            { name: "Won", color: "green" },
            { name: "Lost", color: "red" }
          ]
        }
      },
      "Amount": { number: { format: "currency" } },
      "Deposit Ref #": { rich_text: {} },
      "Payment Proof URL": { url: {} }
    }
  });

  const contactsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Contacts" } }],
    properties: {
      "Contact Name": { title: {} },
      "Phone": { phone_number: {} },
      "Email": { email: {} },
      "Position": { rich_text: {} },
      "Primary Contact Flag": { checkbox: {} }
    }
  });

  const salesLogsDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Sales Logs" } }],
    properties: {
      "Log Title / ID": { title: {} },
      "Interaction Type": {
        select: {
          options: [
            { name: "Call", color: "blue" },
            { name: "Meeting", color: "green" },
            { name: "Note", color: "gray" }
          ]
        }
      },
      "Activity Date": { date: {} },
      "Note Content": { rich_text: {} },
      "Location": { rich_text: {} }
    }
  });

  const queueDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Rotational Queue" } }],
    properties: {
      "Rep Identifier": { title: {} },
      "Order Position": { number: { format: "number" } },
      "Availability Status": {
        select: {
          options: [
            { name: "Available", color: "green" },
            { name: "Busy", color: "yellow" },
            { name: "Offline", color: "red" }
          ]
        }
      },
      "Last Assigned Timestamp": { date: {} }
    }
  });

  console.log("🔗 Linking relational database properties...");

  // PHASE 2: Apply two-way relations
  await notion.databases.update({
    database_id: accountsDb.id,
    properties: {
      "Owner": {
        relation: {
          database_id: salesRepsDb.id,
          type: "dual_property",
          dual_property: { synced_property_name: "Accounts" }
        }
      }
    }
  });

  await notion.databases.update({
    database_id: dealsDb.id,
    properties: {
      "Account": {
        relation: {
          database_id: accountsDb.id,
          type: "dual_property",
          dual_property: { synced_property_name: "Deals" }
        }
      },
      "Assigned Rep": {
        relation: {
          database_id: salesRepsDb.id,
          type: "dual_property",
          dual_property: { synced_property_name: "Deals" }
        }
      }
    }
  });

  await notion.databases.update({
    database_id: contactsDb.id,
    properties: {
      "Account": {
        relation: {
          database_id: accountsDb.id,
          type: "dual_property",
          dual_property: { synced_property_name: "Contacts" }
        }
      }
    }
  });

  await notion.databases.update({
    database_id: salesLogsDb.id,
    properties: {
      "Deal": {
        relation: {
          database_id: dealsDb.id,
          type: "dual_property",
          dual_property: { synced_property_name: "Sales Logs" }
        }
      },
      "Logged By": {
        relation: {
          database_id: salesRepsDb.id,
          type: "dual_property",
          dual_property: { synced_property_name: "Sales Logs" }
        }
      }
    }
  });

  await notion.databases.update({
    database_id: queueDb.id,
    properties: {
      "Sales Rep": {
        relation: {
          database_id: salesRepsDb.id,
          type: "single_property",
          single_property: {}
        }
      }
    }
  });

  const envAdditions = `
# Notion Database IDs generated on ${new Date().toISOString()}
NOTION_SALES_REPS_DB_ID=${salesRepsDb.id}
NOTION_ACCOUNTS_DB_ID=${accountsDb.id}
NOTION_DEALS_DB_ID=${dealsDb.id}
NOTION_CONTACTS_DB_ID=${contactsDb.id}
NOTION_SALES_LOGS_DB_ID=${salesLogsDb.id}
NOTION_QUEUE_DB_ID=${queueDb.id}
`;

  fs.writeFileSync(path.resolve(__dirname, "../../.env.generated"), envAdditions);
  console.log("✅ All 6 databases created and linked successfully!");
  console.log("📄 Saved database IDs to .env.generated");
}

run().catch((err) => {
  console.error("❌ Setup failed:", err);
  process.exit(1);
});
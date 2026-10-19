import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

const envPath = fs.existsSync(path.resolve(process.cwd(), ".env"))
  ? path.resolve(process.cwd(), ".env")
  : path.resolve(process.cwd(), "../.env");
dotenv.config({ path: envPath });

function extractNotionId(rawInput?: string): string | null {
  if (!rawInput) return null;
  const cleaned = rawInput.trim();
  const match =
    cleaned.match(/([a-f0-9]{32})/i) ||
    cleaned.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  return match ? match[1]!.replace(/-/g, "") : null;
}

const rawParent = process.env.NOTION_PARENT_PAGE_ID;
const parentPageId = extractNotionId(rawParent);

if (!parentPageId || !process.env.NOTION_API_KEY) {
  console.error("❌ Missing valid NOTION_API_KEY or NOTION_PARENT_PAGE_ID in .env");
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const INITIAL_CATALOG = [
  {
    itemCode: "YC345GF",
    productName: "SILENT DIESEL GENERATOR SET YC345GF",
    productDescription:
      "Standby Power: 380KVA/304KW\nPrime Power: 345KVA/276KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Insulation class : H\nEngine: YUCHAI Heavy Duty Diesel\nAlternator: YUCHAI Brushless Synchronous",
    unitPrice: 1850000,
    quantityInStock: 4,
  },
  {
    itemCode: "ATS-400A",
    productName: "ATS (Automatic Transfer Switch 400A)",
    productDescription:
      "Rating: 400A, 4-Pole Dual Power Automatic Switching Unit\nOperational Voltage: 400V / 230V, 50Hz\nTransition Time: < 0.2s\nController: Microprocessor AMF Auto-Start Interface",
    unitPrice: 120000,
    quantityInStock: 10,
  },
  {
    itemCode: "YC150GF",
    productName: "SILENT DIESEL GENERATOR SET YC150GF",
    productDescription:
      "Standby Power: 165KVA/132KW\nPrime Power: 150KVA/120KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Insulation class : H\nEngine: YUCHAI Heavy Duty Diesel\nAlternator: YUCHAI Brushless Synchronous",
    unitPrice: 1250000,
    quantityInStock: 5,
  },
  {
    itemCode: "YC50GF",
    productName: "SILENT DIESEL GENERATOR SET YC50GF",
    productDescription:
      "Standby Power: 55KVA/44KW\nPrime Power: 50KVA/40KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Soundproof Enclosure\nEngine: YUCHAI 4-Cylinder Diesel\nAlternator: YUCHAI 100% Copper Brushless",
    unitPrice: 650000,
    quantityInStock: 8,
  },
  {
    itemCode: "YCP4IN",
    productName: "YC DIESEL WATER PUMP SET 4-INCH",
    productDescription:
      "Suction/Discharge: 100mm (4 Inch)\nMax Flow: 96 m3/h\nMax Head: 32m\nEngine: Yuchai 4-stroke Direct Injection Diesel\nSelf-priming Centrifugal Cast Iron Casing",
    unitPrice: 280000,
    quantityInStock: 6,
  },
];

async function main() {
  console.log(`📦 Creating Notion Inventory Database under page ID: ${parentPageId}...`);

  const inventoryDb = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Inventory & Stock Catalog" } }],
    initial_data_source: {
      properties: {
        "Product Name": { title: {} },
        "Item Code": { rich_text: {} },
        "Technical Specs": { rich_text: {} },
        "Price": { number: { format: "number_with_commas" } },
        "Quantity in Stock": { number: { format: "number" } },
        "Status": {
          select: {
            options: [
              { name: "In Stock", color: "green" },
              { name: "Low Stock", color: "orange" },
              { name: "Out of Stock", color: "red" },
            ],
          },
        },
      },
    },
  });

  console.log(`✅ Notion Inventory Database created! ID: ${inventoryDb.id}`);

  // Seed items
  console.log("🌱 Seeding initial inventory items into Notion...");
  for (const item of INITIAL_CATALOG) {
    const status =
      item.quantityInStock === 0
        ? "Out of Stock"
        : item.quantityInStock <= 2
        ? "Low Stock"
        : "In Stock";

    await notion.pages.create({
      parent: { database_id: inventoryDb.id },
      properties: {
        "Product Name": {
          title: [{ text: { content: item.productName } }],
        },
        "Item Code": {
          rich_text: [{ text: { content: item.itemCode } }],
        },
        "Technical Specs": {
          rich_text: [{ text: { content: item.productDescription } }],
        },
        "Price": {
          number: item.unitPrice,
        },
        "Quantity in Stock": {
          number: item.quantityInStock,
        },
        "Status": {
          select: { name: status },
        },
      },
    });
    console.log(`  ✓ Added ${item.itemCode}: ${item.productName}`);
  }

  // Update .env file
  let envContent = fs.readFileSync(envPath, "utf8");
  if (envContent.includes("NOTION_INVENTORY_DB_ID=")) {
    envContent = envContent.replace(
      /NOTION_INVENTORY_DB_ID=.*/,
      `NOTION_INVENTORY_DB_ID=${inventoryDb.id}`
    );
  } else {
    envContent += `\nNOTION_INVENTORY_DB_ID=${inventoryDb.id}\n`;
  }
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log(`📝 Updated .env with NOTION_INVENTORY_DB_ID=${inventoryDb.id}`);
  console.log("🎉 Inventory provisioning complete!");
}

main().catch((err) => {
  console.error("❌ Failed to provision Notion Inventory DB:", err);
  process.exit(1);
});

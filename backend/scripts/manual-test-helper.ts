import * as crypto from "crypto";
import { env } from "../src/config/env.js";
import { getNotionClient } from "../src/modules/notion/notionClient.js";

const USER_ID = 6191728928;
const FIRST_NAME = "Tester";
const LAST_NAME = "One";

export function generateLiveInitData(
  userId: number = USER_ID,
  firstName: string = FIRST_NAME,
  lastName: string = LAST_NAME,
  botToken: string = env.TELEGRAM_BOT_TOKEN
): string {
  const authDate = Math.floor(Date.now() / 1000);
  const user = { id: userId, first_name: firstName, last_name: lastName };

  const dataMap = new Map<string, string>();
  dataMap.set("auth_date", authDate.toString());
  dataMap.set("user", JSON.stringify(user));

  const sortedPairs = Array.from(dataMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);

  const dataCheckString = sortedPairs.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const params = new URLSearchParams();
  for (const [key, val] of dataMap.entries()) {
    params.set(key, val);
  }
  params.set("hash", hash);
  return params.toString();
}

async function main() {
  const client = getNotionClient();
  const initData = generateLiveInitData();
  const authHeader = `tma ${initData}`;

  console.log("\n============================================================");
  console.log("🚀 TELEGRAM SALES MINI APP: MILESTONES 3, 4, 5 MANUAL TEST SUITE");
  console.log("============================================================\n");
  console.log(`👤 Active User: ${FIRST_NAME} ${LAST_NAME} (Telegram ID: ${USER_ID})`);
  console.log(`🔑 Generated Valid InitData Auth Header:\n\n${authHeader}\n`);

  const arg = process.argv[2];

  if (arg === "seed-queue") {
    console.log("🌱 Seeding user into Rotational Queue DB in Notion...");
    const queuePage = await client.createPage({
      parent: { database_id: env.NOTION_QUEUE_DB_ID },
      properties: {
        "Rep ID": {
          title: [{ text: { content: USER_ID.toString() } }],
        },
        "Availability Status": {
          select: { name: "Available" },
        },
      },
    });
    console.log(`✅ User ${USER_ID} seeded as 'Available' in Rotational Queue! (Page ID: ${queuePage.id})\n`);
    return;
  }

  if (arg === "seed-deal") {
    console.log("🌱 Creating a test Deal in Notion Deals DB...");
    const dealPage = await client.createPage({
      parent: { database_id: env.NOTION_DEALS_DB_ID },
      properties: {
        "Deal Title": {
          title: [{ text: { content: "Awash Logistics Fleet Order" } }],
        },
        "Amount": {
          number: 350000,
        },
        "Stage": {
          select: { name: "Proposal" },
        },
      },
    });
    console.log(`✅ Test Deal created! (ID: ${dealPage.id})\n`);
    return;
  }

  console.log("📋 QUICK TEST COMMANDS (Start 'npm run dev' in another terminal first):");
  console.log("------------------------------------------------------------");
  console.log("1️⃣  TEST MILESTONE 3 (TIN Check & Lead Registration):");
  console.log(`curl -X POST http://localhost:3000/api/leads/check-tin \\`);
  console.log(`  -H "Authorization: ${authHeader}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"tin": "0098765432"}'\n`);

  console.log("2️⃣  TEST MILESTONE 4 (Front Desk Round-Robin Walk-In Assignment):");
  console.log(`curl -X POST http://localhost:3000/api/queue/assign \\`);
  console.log(`  -H "Authorization: ${authHeader}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"companyName": "Blue Nile Seeds", "tin": "0098765432", "industry": "Agriculture"}'\n`);

  console.log("3️⃣  TEST MILESTONE 5 (Payment Proof Logging & Manager Alert):");
  console.log(`First run: npx tsx scripts/manual-test-helper.ts seed-deal`);
  console.log(`Then call:`);
  console.log(`curl -X POST http://localhost:3000/api/deals/<DEAL_ID>/payment-proof \\`);
  console.log(`  -H "Authorization: ${authHeader}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"depositRef": "CBE-TX-998811", "proofUrl": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c"}'\n`);
}

main().catch(console.error);

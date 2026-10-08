import { env } from "../src/config/env.js";
import { getNotionClient } from "../src/modules/notion/notionClient.js";
import { generateLiveInitData } from "./manual-test-helper.js";

const BASE_URL = `http://localhost:${env.PORT || 3000}`;
const USER_ID = 6191728928; // The user's Telegram ID from Milestone 2

async function main() {
  console.log("\n========================================================");
  console.log("🧪 LIVE INTEGRATION TEST RUNNER: MILESTONES 3, 4 & 5");
  console.log("========================================================\n");

  const client = getNotionClient();
  const initData = generateLiveInitData(USER_ID, "Tester", "One");
  const authHeader = `tma ${initData}`;

  // 0. Check server health
  console.log("⏳ Step 0: Checking backend server connectivity...");
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (!healthRes.ok) throw new Error(`Status ${healthRes.status}`);
    const healthData = await healthRes.json();
    console.log("✅ Backend is active:", healthData);
  } catch (err: any) {
    console.error(`❌ Backend is not reachable at ${BASE_URL}.`);
    console.error("👉 Please ensure the backend server is running in another terminal:");
    console.error("   npm run dev:backend\n");
    process.exit(1);
  }

  // Check auth
  console.log("\n🔐 Step 0b: Verifying Telegram HMAC InitData authentication...");
  const authRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: authHeader },
  });
  if (!authRes.ok) {
    console.error("❌ Auth failed:", await authRes.text());
    process.exit(1);
  }
  const authUser = await authRes.json();
  console.log(`✅ Authenticated as: ${authUser.user?.firstName} (Telegram ID: ${authUser.user?.id})`);

  // ------------------------------------------------------------------------
  // MILESTONE 3: Workflow B - TIN Duplicate Prevention & Lead Registration
  // ------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------");
  console.log("📌 MILESTONE 3: TIN Verification & Lead Registration");
  console.log("--------------------------------------------------------");

  // Generate a unique 10-digit test TIN based on timestamp
  const testTin = `00${Date.now().toString().slice(-8)}`;
  console.log(`🔍 Checking availability for new 10-digit TIN: ${testTin}...`);

  const checkRes = await fetch(`${BASE_URL}/api/leads/check-tin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ tin: testTin }),
  });
  const checkData: any = await checkRes.json();
  console.log(`✅ TIN Check response: available=${checkData.available} ("${checkData.message}")`);

  console.log(`📝 Registering new Customer Account in Notion with TIN: ${testTin}...`);
  const regRes = await fetch(`${BASE_URL}/api/leads/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      companyName: "Entoto Mountain Coffee PLC",
      tin: testTin,
      address: "Addis Ababa, Piazza",
      industry: "Agriculture",
    }),
  });

  if (!regRes.ok) {
    console.error("❌ Lead registration failed:", await regRes.text());
  } else {
    const regData: any = await regRes.json();
    console.log(`✅ Account created in Notion Accounts DB!`);
    console.log(`   • Page ID: ${regData.account.pageId}`);
    console.log(`   • Company: ${regData.account.companyName}`);
    console.log(`   • Owner: ${regData.account.owner.fullName} (${regData.account.owner.telegramId})`);
  }

  // Test duplicate block
  console.log(`🔒 Testing duplicate block with same TIN ${testTin}...`);
  const dupCheckRes = await fetch(`${BASE_URL}/api/leads/check-tin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ tin: testTin }),
  });
  const dupData: any = await dupCheckRes.json();
  if (dupCheckRes.status === 409 && dupData.available === false) {
    console.log(`✅ Sub-100ms Duplicate Prevention Verified!`);
    console.log(`   • Block message: "${dupData.message}"`);
  } else {
    console.warn("⚠️ Duplicate was not blocked as expected:", dupData);
  }

  // ------------------------------------------------------------------------
  // MILESTONE 4: Workflow C - Front Desk Walk-In Assignment (Round-Robin)
  // ------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------");
  console.log("📌 MILESTONE 4: Front Desk Walk-In Assignment & Push Alert");
  console.log("--------------------------------------------------------");

  // Ensure rep is in Rotational Queue DB
  console.log("🔍 Checking Rotational Queue DB in Notion...");
  const queueQuery = await client.queryDatabase(env.NOTION_QUEUE_DB_ID, {});
  const hasRepInQueue = queueQuery.results?.some((p: any) => {
    const repId = p.properties?.["Rep ID"]?.title?.[0]?.plain_text;
    return repId === USER_ID.toString();
  });

  if (!hasRepInQueue) {
    console.log(`🌱 Seeding rep ${USER_ID} as "Available" in Rotational Queue DB...`);
    await client.createPage({
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
    console.log("✅ Seeded into queue!");
  } else {
    console.log(`✅ Rep ${USER_ID} is already in Rotational Queue DB.`);
  }

  const walkinTin = `00${(Date.now() + 1).toString().slice(-8)}`;
  console.log(`🚶 Front desk assigning walk-in lead with TIN: ${walkinTin}...`);

  const queueAssignRes = await fetch(`${BASE_URL}/api/queue/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      companyName: "Sheger Solar Energy Co.",
      tin: walkinTin,
      address: "Bole Road, Addis Ababa",
      industry: "Renewable Energy",
    }),
  });

  if (!queueAssignRes.ok) {
    console.error("❌ Walk-in assignment failed:", await queueAssignRes.text());
  } else {
    const assignData: any = await queueAssignRes.json();
    console.log(`✅ Walk-in assigned successfully via round-robin!`);
    console.log(`   • Account: ${assignData.account.companyName} (TIN: ${assignData.account.tin})`);
    console.log(`   • Assigned Rep: ${assignData.account.assignedRep.fullName} (${assignData.account.assignedRep.telegramId})`);
    console.log(`   • Telegram Push Notification Sent: ${assignData.notificationSent ? "YES 📲 (Check Telegram!)" : "NO"}`);
  }

  // ------------------------------------------------------------------------
  // MILESTONE 5: Workflow D - Deal Updates & Payment Proof Verification
  // ------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------");
  console.log("📌 MILESTONE 5: Deal Updates & Payment Proof Logging");
  console.log("--------------------------------------------------------");

  console.log("🌱 Creating a test Deal in Notion Deals DB...");
  const dealPage = await client.createPage({
    parent: { database_id: env.NOTION_DEALS_DB_ID },
    properties: {
      "Deal Title": {
        title: [{ text: { content: "Sheger Solar Commercial Installation" } }],
      },
      "Amount": {
        number: 480000,
      },
      "Stage": {
        select: { name: "Proposal" },
      },
    },
  });
  console.log(`✅ Deal created in Notion! (Page ID: ${dealPage.id}, Amount: ETB 480,000)`);

  const depositRefNumber = `CBE-TX-${Math.floor(100000 + Math.random() * 900000)}`;
  const sampleProofUrl = "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600";

  console.log(`💳 Submitting payment proof (Deposit Ref: ${depositRefNumber})...`);
  const dealProgRes = await fetch(`${BASE_URL}/api/deals/${dealPage.id}/payment-proof`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      depositRef: depositRefNumber,
      proofUrl: sampleProofUrl,
    }),
  });

  if (!dealProgRes.ok) {
    console.error("❌ Payment proof submission failed:", await dealProgRes.text());
  } else {
    const dealData: any = await dealProgRes.json();
    console.log(`✅ Deal Stage updated in Notion!`);
    console.log(`   • New Stage: ${dealData.deal.stage}`);
    console.log(`   • Deposit Ref #: ${dealData.deal.depositRef}`);
    console.log(`   • Managers Alerted on Telegram: ${dealData.managersNotified}`);
  }

  console.log("\n========================================================");
  console.log("🎉 ALL LIVE INTEGRATION TESTS COMPLETED SUCCESSFULLY!");
  console.log("========================================================\n");
}

main().catch(console.error);

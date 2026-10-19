import type { ResilientNotionClient } from "../notion/notionClient.js";
import { env } from "../../config/env.js";

export interface InventoryItem {
  id: string;
  itemCode: string;
  productName: string;
  productDescription: string;
  unitPrice: number;
  quantityInStock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

export interface LineItem {
  itemNo?: number;
  itemCode?: string;
  productName: string;
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

export interface CreateAdjustmentRequestInput {
  itemId?: string;
  itemCode: string;
  productName?: string;
  delta: number;
  reason: string;
  requestedByTelegramId: number;
  requestedByName: string;
}

export interface PendingStockAdjustment {
  requestId: string;
  itemId: string;
  itemCode: string;
  productName: string;
  currentStock: number;
  delta: number;
  newStock: number;
  unitPrice: number;
  reason: string;
  requestedByTelegramId: number;
  requestedByName: string;
  requestedAt: string;
  status: "Pending" | "Approved" | "Rejected";
  approvedByName?: string;
}

export interface DirectAdjustInput {
  itemId?: string;
  itemCode: string;
  productName?: string;
  delta?: number;
  newQuantity?: number;
  reason?: string;
  updatedByName: string;
}

export interface DeductResult {
  success: boolean;
  deductedItems: Array<{
    itemCode: string;
    productName: string;
    previousStock: number;
    deductedQty: number;
    remainingStock: number;
  }>;
}

export interface InventoryServiceOptions {
  notionClient?: ResilientNotionClient | undefined;
  inventoryDbId?: string | undefined;
  salesLogsDbId?: string | undefined;
}

export const DEFAULT_CATALOG: InventoryItem[] = [
  {
    id: "seed-yc345gf",
    itemCode: "YC345GF",
    productName: "SILENT DIESEL GENERATOR SET YC345GF",
    productDescription:
      "Standby Power: 344KVA/275KW\nPrime Power: 313KVA/250KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Insulation class : H\nEngine:YUCHAI\nModel:YC6MK420L-D20\nAlternator: YUCHAI\nModel: YC-250-4",
    unitPrice: 1850000,
    quantityInStock: 4,
    status: "In Stock",
  },
  {
    id: "seed-ats400a",
    itemCode: "ATS-400A",
    productName: "ATS (Automatic Transfer Switch 400A)",
    productDescription:
      "Rating: 400A, 4-Pole Dual Power Automatic Switching Unit\nOperational Voltage: 400V / 230V, 50Hz\nTransition Time: < 0.2s\nController: Microprocessor AMF Auto-Start Interface",
    unitPrice: 120000,
    quantityInStock: 10,
    status: "In Stock",
  },
  {
    id: "seed-yc150gf",
    itemCode: "YC150GF",
    productName: "SILENT DIESEL GENERATOR SET YC150GF",
    productDescription:
      "Standby Power: 165KVA/132KW\nPrime Power: 150KVA/120KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Insulation class : H\nEngine: YUCHAI Heavy Duty Diesel\nAlternator: YUCHAI Brushless Synchronous",
    unitPrice: 1250000,
    quantityInStock: 5,
    status: "In Stock",
  },
  {
    id: "seed-yc50gf",
    itemCode: "YC50GF",
    productName: "SILENT DIESEL GENERATOR SET YC50GF",
    productDescription:
      "Standby Power: 55KVA/44KW\nPrime Power: 50KVA/40KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Soundproof Enclosure\nEngine: YUCHAI 4-Cylinder Diesel\nAlternator: YUCHAI 100% Copper Brushless",
    unitPrice: 650000,
    quantityInStock: 8,
    status: "In Stock",
  },
  {
    id: "seed-ycp4in",
    itemCode: "YCP4IN",
    productName: "YC DIESEL WATER PUMP SET 4-INCH",
    productDescription:
      "Suction/Discharge: 100mm (4 Inch)\nMax Flow: 96 m3/h\nMax Head: 32m\nEngine: Yuchai 4-stroke Direct Injection Diesel\nSelf-priming Centrifugal Cast Iron Casing",
    unitPrice: 280000,
    quantityInStock: 6,
    status: "In Stock",
  },
];

export class InventoryService {
  private readonly notionClient?: ResilientNotionClient;
  private readonly inventoryDbId: string;
  private readonly salesLogsDbId: string;

  private catalogCache: InventoryItem[] = [];
  private lastCacheTime = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private pendingAdjustments: Map<string, PendingStockAdjustment> = new Map();

  constructor(options: InventoryServiceOptions = {}) {
    this.notionClient = options.notionClient;
    this.inventoryDbId = options.inventoryDbId || env.NOTION_INVENTORY_DB_ID || "";
    this.salesLogsDbId = options.salesLogsDbId || env.NOTION_SALES_LOGS_DB_ID;

    // Initialize in-memory cache with clone of seed data
    this.catalogCache = DEFAULT_CATALOG.map((item) => ({ ...item }));
    this.lastCacheTime = 0; // Ensures first listCatalog fetches from Notion if configured
  }

  /**
   * Retrieves all catalog items. Uses in-memory cache if valid (<5 mins),
   * else queries Notion Inventory DB if configured.
   */
  public async listCatalog(forceRefresh = false): Promise<InventoryItem[]> {
    const isCacheValid = !forceRefresh && Date.now() - this.lastCacheTime < this.CACHE_TTL_MS;
    if (isCacheValid && this.catalogCache.length > 0) {
      return this.catalogCache;
    }

    if (this.notionClient && this.inventoryDbId) {
      try {
        const response = (await this.notionClient.queryDatabase(this.inventoryDbId, {})) as {
          results: any[];
        };

        if (response?.results && response.results.length > 0) {
          const fetched: InventoryItem[] = [];
          for (const page of response.results) {
            const props = page.properties;
            const productName =
              props?.["Product Name"]?.title?.[0]?.plain_text ||
              props?.["Name"]?.title?.[0]?.plain_text ||
              "";
            const itemCode =
              props?.["Item Code"]?.rich_text?.[0]?.plain_text ||
              props?.["Code"]?.rich_text?.[0]?.plain_text ||
              "";
            const productDescription =
              props?.["Description"]?.rich_text?.[0]?.plain_text ||
              props?.["Technical Specs"]?.rich_text?.[0]?.plain_text ||
              "";
            const unitPrice = props?.["Price"]?.number || props?.["Unit Price"]?.number || 0;
            const quantityInStock = props?.["Quantity in Stock"]?.number || props?.["Stock"]?.number || 0;
            const status = (props?.["Status"]?.select?.name as any) || (quantityInStock > 0 ? "In Stock" : "Out of Stock");

            if (productName || itemCode) {
              fetched.push({
                id: page.id,
                itemCode: itemCode || productName.split(" ").slice(-1)[0] || "ITEM",
                productName,
                productDescription,
                unitPrice,
                quantityInStock,
                status,
              });
            }
          }

          if (fetched.length > 0) {
            this.catalogCache = fetched;
            this.lastCacheTime = Date.now();
            return this.catalogCache;
          }
        }
      } catch (err: any) {
        console.warn("Could not query Notion Inventory DB, using memory catalog:", err.message);
      }
    }

    return this.catalogCache;
  }

  /**
   * Searches for an item by Item Code (exact/case-insensitive) or Product Name (partial).
   */
  public async findItemByCodeOrName(query: string): Promise<InventoryItem | null> {
    if (!query || !query.trim()) return null;
    const catalog = await this.listCatalog();
    const cleanQuery = query.trim().toLowerCase();

    // 1. Check exact item code
    const byCode = catalog.find((i) => i.itemCode.toLowerCase() === cleanQuery);
    if (byCode) return byCode;

    // 2. Check product name starts with or includes
    const byName = catalog.find((i) => i.productName.toLowerCase().includes(cleanQuery));
    if (byName) return byName;

    // 3. Check item code partial
    const byCodePartial = catalog.find((i) => i.itemCode.toLowerCase().includes(cleanQuery));
    if (byCodePartial) return byCodePartial;

    return null;
  }

  /**
   * Front Desk creates a pending inventory adjustment request.
   * Generates a unique requestId and stores before/after calculations.
   */
  public async createAdjustmentRequest(
    input: CreateAdjustmentRequestInput
  ): Promise<PendingStockAdjustment> {
    const item = await this.findItemByCodeOrName(input.itemCode || input.productName || "");
    const currentStock = item ? item.quantityInStock : 0;
    const delta = input.delta || 0;
    const newStock = Math.max(0, currentStock + delta);
    const unitPrice = item ? item.unitPrice : 0;
    const itemId = item ? item.id : `item-${Date.now()}`;
    const productName = item ? item.productName : input.productName || input.itemCode;
    const itemCode = item ? item.itemCode : input.itemCode;

    const shortId = `req_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const adjustment: PendingStockAdjustment = {
      requestId: shortId,
      itemId,
      itemCode,
      productName,
      currentStock,
      delta,
      newStock,
      unitPrice,
      reason: input.reason || "Inventory Adjustment",
      requestedByTelegramId: input.requestedByTelegramId,
      requestedByName: input.requestedByName,
      requestedAt: now,
      status: "Pending",
    };

    this.pendingAdjustments.set(shortId, adjustment);
    return adjustment;
  }

  /**
   * Retrieves a pending adjustment request by ID.
   */
  public getPendingAdjustment(requestId: string): PendingStockAdjustment | undefined {
    return this.pendingAdjustments.get(requestId);
  }

  /**
   * Retrieves all pending adjustment requests.
   */
  public listPendingAdjustments(): PendingStockAdjustment[] {
    return Array.from(this.pendingAdjustments.values()).filter((a) => a.status === "Pending");
  }

  /**
   * Manager approves a pending adjustment.
   * Applies the new stock count, updates Notion if connected, and marks request Approved.
   */
  public async approveAdjustment(
    requestId: string,
    managerName: string
  ): Promise<InventoryItem> {
    const request = this.pendingAdjustments.get(requestId);
    if (!request || request.status !== "Pending") {
      throw new Error(`Adjustment request not found or already processed: ${requestId}`);
    }

    const updatedItem = await this.applyStockChange(
      request.itemCode,
      request.newStock,
      `Approved by Manager ${managerName}: ${request.reason}`
    );

    request.status = "Approved";
    request.approvedByName = managerName;
    this.pendingAdjustments.set(requestId, request);

    return updatedItem;
  }

  /**
   * Manager rejects a pending adjustment.
   */
  public async rejectAdjustment(
    requestId: string,
    managerName: string
  ): Promise<boolean> {
    const request = this.pendingAdjustments.get(requestId);
    if (!request || request.status !== "Pending") {
      throw new Error(`Adjustment request not found or already processed: ${requestId}`);
    }

    request.status = "Rejected";
    request.approvedByName = managerName;
    this.pendingAdjustments.set(requestId, request);

    return true;
  }

  /**
   * Direct stock adjustment (for Managers or automated routines).
   */
  public async directAdjustStock(input: DirectAdjustInput): Promise<InventoryItem> {
    const item = await this.findItemByCodeOrName(input.itemCode || input.productName || "");
    if (!item) {
      throw new Error(`Inventory item not found: ${input.itemCode}`);
    }

    let finalStock = item.quantityInStock;
    if (input.newQuantity !== undefined) {
      finalStock = Math.max(0, input.newQuantity);
    } else if (input.delta !== undefined) {
      finalStock = Math.max(0, item.quantityInStock + input.delta);
    }

    return this.applyStockChange(
      item.itemCode,
      finalStock,
      `Direct adjustment by ${input.updatedByName}: ${input.reason || "Manual update"}`
    );
  }

  /**
   * Decrements stock for each item in a deal marked as WON.
   */
  public async deductStockForDeal(lineItems: LineItem[]): Promise<DeductResult> {
    const deductedItems: DeductResult["deductedItems"] = [];

    for (const item of lineItems) {
      if (!item.quantity || item.quantity <= 0) continue;
      const target = await this.findItemByCodeOrName(item.itemCode || item.productName);
      if (!target) continue;

      const previousStock = target.quantityInStock;
      const remainingStock = Math.max(0, previousStock - item.quantity);

      await this.applyStockChange(
        target.itemCode,
        remainingStock,
        `Deal Won deduction: -${item.quantity} units for ${item.productName}`
      );

      deductedItems.push({
        itemCode: target.itemCode,
        productName: target.productName,
        previousStock,
        deductedQty: item.quantity,
        remainingStock,
      });
    }

    return { success: true, deductedItems };
  }

  /**
   * Internal helper to persist stock changes in cache and in Notion.
   */
  private async applyStockChange(
    itemCode: string,
    newQuantity: number,
    auditNote: string
  ): Promise<InventoryItem> {
    const item = await this.findItemByCodeOrName(itemCode);
    const targetItem: InventoryItem = item || {
      id: `item-${Date.now()}`,
      itemCode,
      productName: itemCode,
      productDescription: "",
      unitPrice: 0,
      quantityInStock: newQuantity,
      status: newQuantity > 0 ? "In Stock" : "Out of Stock",
    };

    targetItem.quantityInStock = newQuantity;
    targetItem.status =
      newQuantity === 0 ? "Out of Stock" : newQuantity <= 2 ? "Low Stock" : "In Stock";

    // Update in-memory cache
    const existingIdx = this.catalogCache.findIndex(
      (c) => c.itemCode.toLowerCase() === itemCode.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.catalogCache[existingIdx] = { ...targetItem };
    } else {
      this.catalogCache.push({ ...targetItem });
    }
    this.lastCacheTime = Date.now();

    // Persist to Notion DB page if available
    if (this.notionClient && targetItem.id && !targetItem.id.startsWith("seed-")) {
      try {
        await this.notionClient.updatePage({
          page_id: targetItem.id,
          properties: {
            "Quantity in Stock": { number: newQuantity },
            "Status": { select: { name: targetItem.status } },
          },
        });
      } catch (err: any) {
        console.warn(`Could not update Notion page for ${itemCode}:`, err.message);
      }
    }

    // Record audit entry in Notion Sales Logs
    if (this.notionClient && this.salesLogsDbId) {
      try {
        const today = new Date().toISOString().split("T")[0]!;
        await this.notionClient.createPage({
          parent: { database_id: this.salesLogsDbId },
          properties: {
            "Log Title / ID": {
              title: [{ text: { content: `[Inventory] ${itemCode} Stock Adjusted` } }],
            },
            "Interaction Type": {
              select: { name: "Note" },
            },
            "Activity Date": {
              date: { start: today },
            },
            "Note Content": {
              rich_text: [
                {
                  text: {
                    content: `Stock set to ${newQuantity} units. ${auditNote}`,
                  },
                },
              ],
            },
          },
        });
      } catch (logErr: any) {
        console.warn("Could not log stock update to Notion:", logErr.message);
      }
    }

    return targetItem;
  }
}

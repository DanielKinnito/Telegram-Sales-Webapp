import { ResilientNotionClient } from "../notion/notionClient.js";
import { env } from "../../config/env.js";

export const DEFAULT_INVENTORY_DB_ID = "796f44a2-1044-4a4c-8adc-74a97fbbec94";

export interface InventoryItem {
  id: string; // Notion Page ID or synthetic seed ID
  itemCode: string;
  productName: string;
  productDescription: string;
  unitPrice: number;
  quantityInStock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

export interface PendingStockAdjustment {
  requestId: string;
  itemId: string;
  itemCode: string;
  productName: string;
  productDescription?: string | undefined;
  currentStock: number;
  delta: number;
  newStock: number;
  unitPrice: number;
  isNewItem?: boolean | undefined;
  reason: string;
  requestedByTelegramId: number;
  requestedByName: string;
  requestedAt: string;
  status: "Pending" | "Approved" | "Rejected";
  approvedByName?: string | undefined;
}

export interface CreateAdjustmentRequestInput {
  isNewItem?: boolean | undefined;
  itemCode: string;
  productName?: string | undefined;
  productDescription?: string | undefined;
  unitPrice?: number | undefined;
  delta?: number | undefined;
  reason?: string | undefined;
  requestedByTelegramId: number;
  requestedByName: string;
}

export interface DirectAdjustInput {
  isNewItem?: boolean | undefined;
  itemCode: string;
  productName?: string | undefined;
  productDescription?: string | undefined;
  unitPrice?: number | undefined;
  delta?: number | undefined;
  newQuantity?: number | undefined;
  reason?: string | undefined;
  updatedByName: string;
}

export interface LineItem {
  itemCode?: string | undefined;
  productName: string;
  quantity: number;
  unitPrice: number;
  description?: string | undefined;
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
    id: "3fed691d-57eb-81eb-a47c-ccc404d0b0d9",
    itemCode: "YC345GF",
    productName: "SILENT DIESEL GENERATOR SET YC345GF",
    productDescription:
      "Standby Power: 380KVA/304KW\nPrime Power: 345KVA/276KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Insulation class : H\nEngine: YUCHAI Heavy Duty Diesel\nAlternator: YUCHAI Brushless Synchronous",
    unitPrice: 1850000,
    quantityInStock: 0,
    status: "Out of Stock",
  },
  {
    id: "3fed691d-57eb-8180-90e8-e8f38a06e361",
    itemCode: "ATS-400A",
    productName: "ATS (Automatic Transfer Switch 400A)",
    productDescription:
      "Rating: 400A, 4-Pole Dual Power Automatic Switching Unit\nOperational Voltage: 400V / 230V, 50Hz\nTransition Time: < 0.2s\nController: Microprocessor AMF Auto-Start Interface",
    unitPrice: 120000,
    quantityInStock: 10,
    status: "In Stock",
  },
  {
    id: "3fed691d-57eb-818e-875f-efb802c6a5a3",
    itemCode: "YC150GF",
    productName: "SILENT DIESEL GENERATOR SET YC150GF",
    productDescription:
      "Standby Power: 165KVA/132KW\nPrime Power: 150KVA/120KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Insulation class : H\nEngine: YUCHAI Heavy Duty Diesel\nAlternator: YUCHAI Brushless Synchronous",
    unitPrice: 1250000,
    quantityInStock: 5,
    status: "In Stock",
  },
  {
    id: "3fed691d-57eb-812e-83b8-e0487db3744c",
    itemCode: "YC50GF",
    productName: "SILENT DIESEL GENERATOR SET YC50GF",
    productDescription:
      "Standby Power: 55KVA/44KW\nPrime Power: 50KVA/40KW\nRPM:1500\nP.F:0.8\n50HZ, IP Protection: 23, Soundproof Enclosure\nEngine: YUCHAI 4-Cylinder Diesel\nAlternator: YUCHAI 100% Copper Brushless",
    unitPrice: 650000,
    quantityInStock: 8,
    status: "In Stock",
  },
  {
    id: "3fed691d-57eb-811e-a9f0-d24ec2545633",
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
  private readonly notionClient?: ResilientNotionClient | undefined;
  private readonly inventoryDbId: string;
  private readonly salesLogsDbId: string;

  private catalogCache: InventoryItem[] = [];
  private lastCacheTime = 0;
  private readonly CACHE_TTL_MS = 30 * 1000; // 30 seconds

  private pendingAdjustments: Map<string, PendingStockAdjustment> = new Map();

  constructor(options: InventoryServiceOptions = {}) {
    this.notionClient = options.notionClient;
    this.inventoryDbId = options.inventoryDbId || env.NOTION_INVENTORY_DB_ID || DEFAULT_INVENTORY_DB_ID;
    this.salesLogsDbId = options.salesLogsDbId || env.NOTION_SALES_LOGS_DB_ID;

    // Initialize in-memory cache with clone of seed data
    this.catalogCache = DEFAULT_CATALOG.map((item) => ({ ...item }));
    this.lastCacheTime = 0; // Ensures first listCatalog fetches live from Notion
  }

  /**
   * Retrieves all catalog items. Queries live Notion Inventory DB and caches for 30s.
   * If forceRefresh is true, bypasses in-memory cache and re-queries Notion immediately.
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
   * Front Desk creates a pending inventory adjustment request or proposes a new product.
   * Generates a unique requestId and stores before/after calculations.
   */
  public async createAdjustmentRequest(
    input: CreateAdjustmentRequestInput
  ): Promise<PendingStockAdjustment> {
    const isNewItem = Boolean(input.isNewItem);
    const item = isNewItem ? null : await this.findItemByCodeOrName(input.itemCode || input.productName || "");
    const currentStock = item ? item.quantityInStock : 0;
    const delta = input.delta || (isNewItem ? 1 : 0);
    const newStock = isNewItem ? delta : Math.max(0, currentStock + delta);
    const unitPrice = input.unitPrice ?? (item ? item.unitPrice : 0);
    const itemId = item ? item.id : `item-${Date.now()}`;
    const productName = input.productName || (item ? item.productName : input.itemCode);
    const itemCode = input.itemCode ? input.itemCode.trim().toUpperCase() : (item ? item.itemCode : "NEW-ITEM");
    const productDescription = input.productDescription || (item ? item.productDescription : "");

    const shortId = `req_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const adjustment: PendingStockAdjustment = {
      requestId: shortId,
      itemId,
      itemCode,
      productName,
      productDescription,
      currentStock,
      delta,
      newStock,
      unitPrice,
      isNewItem,
      reason: input.reason || (isNewItem ? "New Inventory Model Proposal" : "Inventory Adjustment"),
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
   * Creates a brand new equipment item in Notion and catalog cache.
   */
  public async createCatalogItem(input: {
    itemCode: string;
    productName: string;
    productDescription?: string | undefined;
    unitPrice: number;
    quantityInStock: number;
    auditNote?: string | undefined;
  }): Promise<InventoryItem> {
    const cleanCode = input.itemCode.trim().toUpperCase();
    const cleanName = input.productName.trim();
    const cleanDesc = input.productDescription?.trim() || "";
    const cleanPrice = Number(input.unitPrice) || 0;
    const initialQty = Math.max(0, Number(input.quantityInStock) || 0);
    const status: InventoryItem["status"] =
      initialQty === 0 ? "Out of Stock" : initialQty <= 2 ? "Low Stock" : "In Stock";

    let createdId = `item-${Date.now()}`;

    // Create page in Notion Inventory DB if configured
    if (this.notionClient && this.inventoryDbId) {
      try {
        const page = await this.notionClient.createPage({
          parent: { database_id: this.inventoryDbId },
          properties: {
            "Product Name": {
              title: [{ text: { content: cleanName } }],
            },
            "Item Code": {
              rich_text: [{ text: { content: cleanCode } }],
            },
            "Technical Specs": {
              rich_text: [{ text: { content: cleanDesc } }],
            },
            "Price": {
              number: cleanPrice,
            },
            "Quantity in Stock": {
              number: initialQty,
            },
            "Status": {
              select: { name: status },
            },
          },
        });
        if (page?.id) createdId = page.id;
      } catch (err: any) {
        console.warn(`Could not create Notion page for new item ${cleanCode}:`, err.message);
      }
    }

    const newItem: InventoryItem = {
      id: createdId,
      itemCode: cleanCode,
      productName: cleanName,
      productDescription: cleanDesc,
      unitPrice: cleanPrice,
      quantityInStock: initialQty,
      status,
    };

    // Update memory cache
    const existingIdx = this.catalogCache.findIndex(
      (c) => c.itemCode.toLowerCase() === cleanCode.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.catalogCache[existingIdx] = newItem;
    } else {
      this.catalogCache.push(newItem);
    }
    this.lastCacheTime = 0; // Force refresh

    // Log to Notion Sales Logs
    if (this.notionClient && this.salesLogsDbId) {
      try {
        const today = new Date().toISOString().split("T")[0]!;
        await this.notionClient.createPage({
          parent: { database_id: this.salesLogsDbId },
          properties: {
            "Log Title / ID": {
              title: [{ text: { content: `[Inventory] New Item Added: ${cleanCode}` } }],
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
                    content: `Added new item ${cleanName} (${cleanCode}) with ${initialQty} units at ${cleanPrice.toLocaleString()} ETB. ${input.auditNote || ""}`,
                  },
                },
              ],
            },
          },
        });
      } catch (logErr: any) {
        console.warn("Could not log new item to Notion Sales Logs:", logErr.message);
      }
    }

    return newItem;
  }

  /**
   * Manager approves a pending adjustment or new item proposal.
   * Applies the new stock count or creates the new catalog item in Notion.
   */
  public async approveAdjustment(
    requestId: string,
    managerName: string
  ): Promise<InventoryItem> {
    const request = this.pendingAdjustments.get(requestId);
    if (!request || request.status !== "Pending") {
      throw new Error(`Adjustment request not found or already processed: ${requestId}`);
    }

    let updatedItem: InventoryItem;

    if (request.isNewItem) {
      updatedItem = await this.createCatalogItem({
        itemCode: request.itemCode,
        productName: request.productName,
        productDescription: request.productDescription,
        unitPrice: request.unitPrice,
        quantityInStock: request.newStock,
        auditNote: `Approved by Manager ${managerName}. Requested by ${request.requestedByName}. Note: ${request.reason}`,
      });
    } else {
      updatedItem = await this.applyStockChange(
        request.itemCode,
        request.newStock,
        `Approved by Manager ${managerName}: ${request.reason}`
      );
    }

    request.status = "Approved";
    request.approvedByName = managerName;
    this.pendingAdjustments.set(requestId, request);

    return updatedItem;
  }

  /**
   * Manager rejects a pending adjustment or new item proposal.
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
   * Direct stock adjustment or item creation (for Managers).
   */
  public async directAdjustStock(input: DirectAdjustInput): Promise<InventoryItem> {
    if (input.isNewItem) {
      return this.createCatalogItem({
        itemCode: input.itemCode,
        productName: input.productName || input.itemCode,
        productDescription: input.productDescription,
        unitPrice: input.unitPrice || 0,
        quantityInStock: input.newQuantity ?? (input.delta ?? 1),
        auditNote: `Direct manager creation by ${input.updatedByName}: ${input.reason || "Manual addition"}`,
      });
    }

    const item = await this.findItemByCodeOrName(input.itemCode || input.productName || "");
    if (!item) {
      if (input.productName) {
        // Fallback: create as new item if not found but details provided
        return this.createCatalogItem({
          itemCode: input.itemCode,
          productName: input.productName,
          productDescription: input.productDescription,
          unitPrice: input.unitPrice || 0,
          quantityInStock: input.newQuantity ?? (input.delta ?? 1),
          auditNote: `Direct manager creation by ${input.updatedByName}: ${input.reason || "Manual addition"}`,
        });
      }
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

    // 1. Resolve live Notion page ID if missing or synthetic
    let notionPageId =
      targetItem.id && !targetItem.id.startsWith("seed-") && !targetItem.id.startsWith("item-")
        ? targetItem.id
        : null;

    if (!notionPageId && this.notionClient && this.inventoryDbId) {
      try {
        const queryRes = (await this.notionClient.queryDatabase(this.inventoryDbId, {
          filter: {
            or: [
              { property: "Item Code", rich_text: { equals: itemCode } },
              { property: "Product Name", title: { contains: itemCode } },
            ],
          },
        })) as { results: any[] };

        if (queryRes?.results && queryRes.results.length > 0) {
          notionPageId = queryRes.results[0].id;
          targetItem.id = notionPageId;
        }
      } catch (findErr: any) {
        console.warn(`Could not resolve Notion page for ${itemCode}:`, findErr.message);
      }
    }

    // 2. Persist to Notion DB page if available
    if (this.notionClient && notionPageId) {
      try {
        await this.notionClient.updatePage({
          page_id: notionPageId,
          properties: {
            "Quantity in Stock": { number: newQuantity },
            "Status": { select: { name: targetItem.status } },
          },
        });
      } catch (err: any) {
        console.error(`Failed to update Notion page for ${itemCode}:`, err.message);
        throw new Error(`Failed to update Notion stock for ${itemCode}: ${err.message}`);
      }
    } else if (this.notionClient && this.inventoryDbId) {
      try {
        const newPage = await this.notionClient.createPage({
          parent: { database_id: this.inventoryDbId },
          properties: {
            "Product Name": { title: [{ text: { content: targetItem.productName } }] },
            "Item Code": { rich_text: [{ text: { content: targetItem.itemCode } }] },
            "Price": { number: targetItem.unitPrice },
            "Quantity in Stock": { number: newQuantity },
            "Status": { select: { name: targetItem.status } },
          },
        });
        if (newPage?.id) targetItem.id = newPage.id;
      } catch (createErr: any) {
        console.error(`Failed to create Notion page for ${itemCode}:`, createErr.message);
      }
    }

    // Update in-memory cache and invalidate TTL so subsequent listCatalog queries live
    const existingIdx = this.catalogCache.findIndex(
      (c) => c.itemCode.toLowerCase() === itemCode.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.catalogCache[existingIdx] = { ...targetItem };
    } else {
      this.catalogCache.push({ ...targetItem });
    }
    this.lastCacheTime = 0; // Ensures next read queries fresh from Notion

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

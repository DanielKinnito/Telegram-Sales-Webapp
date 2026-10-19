import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InventoryService,
  type InventoryItem,
  type CreateAdjustmentRequestInput,
} from "./inventoryService.js";

describe("InventoryService", () => {
  let mockNotionClient: any;
  let service: InventoryService;

  beforeEach(() => {
    mockNotionClient = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
      updatePage: vi.fn(),
      retrievePage: vi.fn(),
      retrieveDatabase: vi.fn(),
      createDatabase: vi.fn(),
    };
    service = new InventoryService({
      notionClient: mockNotionClient,
      inventoryDbId: "test-inventory-db",
    });
  });

  describe("listCatalog", () => {
    it("returns catalog items from Notion and caches them", async () => {
      mockNotionClient.queryDatabase.mockResolvedValueOnce({
        results: [
          {
            id: "page-yc345",
            properties: {
              "Product Name": {
                title: [{ plain_text: "SILENT DIESEL GENERATOR SET YC345GF" }],
              },
              "Item Code": {
                rich_text: [{ plain_text: "YC345GF" }],
              },
              "Description": {
                rich_text: [{ plain_text: "Standby Power: 344KVA/275KW\nPrime Power: 313KVA/250KW" }],
              },
              "Price": {
                number: 1850000,
              },
              "Quantity in Stock": {
                number: 4,
              },
              "Status": {
                select: { name: "In Stock" },
              },
            },
          },
        ],
      });

      const items = await service.listCatalog();
      expect(items).toHaveLength(1);
      expect(items[0]?.itemCode).toBe("YC345GF");
      expect(items[0]?.productName).toBe("SILENT DIESEL GENERATOR SET YC345GF");
      expect(items[0]?.quantityInStock).toBe(4);
      expect(items[0]?.unitPrice).toBe(1850000);

      // Second call should hit the cache without re-querying Notion
      const cached = await service.listCatalog();
      expect(cached).toHaveLength(1);
      expect(mockNotionClient.queryDatabase).toHaveBeenCalledTimes(1);
    });

    it("falls back to default initial seed items if Notion DB is empty or fails", async () => {
      mockNotionClient.queryDatabase.mockRejectedValueOnce(new Error("Notion query failed"));

      const items = await service.listCatalog();
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.itemCode === "YC345GF")).toBe(true);
      expect(items.some((i) => i.itemCode === "ATS-400A")).toBe(true);
    });
  });

  describe("findItemByCodeOrName", () => {
    it("finds item by exact item code or case-insensitive partial product name", async () => {
      const item = await service.findItemByCodeOrName("YC345GF");
      expect(item).toBeDefined();
      expect(item?.itemCode).toBe("YC345GF");

      const itemByName = await service.findItemByCodeOrName("silent diesel generator");
      expect(itemByName).toBeDefined();
      expect(itemByName?.productName).toContain("SILENT DIESEL GENERATOR");
    });

    it("returns null when no matching item found", async () => {
      const notFound = await service.findItemByCodeOrName("NON_EXISTENT_XYZ");
      expect(notFound).toBeNull();
    });
  });

  describe("Adjustment Request Lifecycle (Front Desk -> Manager Approval)", () => {
    it("creates a pending adjustment request with accurate before/after stock levels", async () => {
      const reqInput: CreateAdjustmentRequestInput = {
        itemCode: "YC345GF",
        delta: 2,
        reason: "Received shipment from factory",
        requestedByTelegramId: 987654321,
        requestedByName: "Selamawit Tadesse",
      };

      const pending = await service.createAdjustmentRequest(reqInput);
      expect(pending.requestId).toBeDefined();
      expect(pending.status).toBe("Pending");
      expect(pending.itemCode).toBe("YC345GF");
      expect(pending.delta).toBe(2);
      expect(pending.newStock).toBe(pending.currentStock + 2);
      expect(pending.requestedByName).toBe("Selamawit Tadesse");

      const retrieved = service.getPendingAdjustment(pending.requestId);
      expect(retrieved).toEqual(pending);
    });

    it("approves pending adjustment, updates stock, and records manager name", async () => {
      const pending = await service.createAdjustmentRequest({
        itemCode: "YC345GF",
        delta: 3,
        reason: "New stock arrival",
        requestedByTelegramId: 987654321,
        requestedByName: "Selamawit Tadesse",
      });

      const updatedItem = await service.approveAdjustment(pending.requestId, "Daniel Mekonnen");
      expect(updatedItem.quantityInStock).toBe(pending.newStock);

      const check = service.getPendingAdjustment(pending.requestId);
      expect(check?.status).toBe("Approved");
      expect(check?.approvedByName).toBe("Daniel Mekonnen");
    });

    it("rejects pending adjustment without altering stock level", async () => {
      const initialItem = await service.findItemByCodeOrName("YC345GF");
      const initialStock = initialItem?.quantityInStock || 0;

      const pending = await service.createAdjustmentRequest({
        itemCode: "YC345GF",
        delta: 5,
        reason: "Mistyped count",
        requestedByTelegramId: 987654321,
        requestedByName: "Front Desk Rep",
      });

      const rejected = await service.rejectAdjustment(pending.requestId, "Daniel Mekonnen");
      expect(rejected).toBe(true);

      const check = service.getPendingAdjustment(pending.requestId);
      expect(check?.status).toBe("Rejected");

      const afterItem = await service.findItemByCodeOrName("YC345GF");
      expect(afterItem?.quantityInStock).toBe(initialStock);
    });

    it("throws error when approving already finalized or invalid request", async () => {
      await expect(
        service.approveAdjustment("invalid_req_id", "Daniel Mekonnen")
      ).rejects.toThrow(/Adjustment request not found/);
    });
  });

  describe("deductStockForDeal", () => {
    it("decrements inventory quantities when a deal is Won", async () => {
      const initialItem = await service.findItemByCodeOrName("YC345GF");
      const initialStock = initialItem?.quantityInStock || 4;

      const result = await service.deductStockForDeal([
        {
          itemCode: "YC345GF",
          productName: "SILENT DIESEL GENERATOR SET YC345GF",
          quantity: 2,
          unitPrice: 1850000,
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.deductedItems).toHaveLength(1);
      expect(result.deductedItems[0]?.deductedQty).toBe(2);
      expect(result.deductedItems[0]?.remainingStock).toBe(initialStock - 2);

      const current = await service.findItemByCodeOrName("YC345GF");
      expect(current?.quantityInStock).toBe(initialStock - 2);
    });

    it("clamps deduction to 0 if quantity requested exceeds available stock", async () => {
      const result = await service.deductStockForDeal([
        {
          itemCode: "YC345GF",
          productName: "SILENT DIESEL GENERATOR SET YC345GF",
          quantity: 9999,
          unitPrice: 1850000,
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.deductedItems[0]?.remainingStock).toBe(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createBot,
  setBotInventoryService,
  sendStockAdjustmentAlertToManagers,
} from "./bot.js";
import type { PendingStockAdjustment } from "../inventory/inventoryService.js";

describe("Bot Inventory Adjustment Approval Handlers", () => {
  let mockSalesRepsService: any;
  let mockInventoryService: any;
  let bot: any;

  beforeEach(() => {
    mockSalesRepsService = {
      isManager: vi.fn(),
      findSalesRepByTelegramId: vi.fn(),
    };

    mockInventoryService = {
      getPendingAdjustment: vi.fn(),
      approveAdjustment: vi.fn(),
      rejectAdjustment: vi.fn(),
    };

    setBotInventoryService(mockInventoryService);

    bot = createBot({
      token: "mock-token",
      salesRepsService: mockSalesRepsService,
      managerChatIds: [999999],
    });
  });

  it("sendStockAdjustmentAlertToManagers formats and dispatches rich details to managers", async () => {
    const mockBotApi = {
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 101 }),
      },
    };

    const adjustment: PendingStockAdjustment = {
      requestId: "req_xyz123",
      itemId: "item-1",
      itemCode: "YC345GF",
      productName: "SILENT DIESEL GENERATOR SET YC345GF",
      currentStock: 4,
      delta: 2,
      newStock: 6,
      unitPrice: 1850000,
      reason: "New shipment arrived from Akaki customs",
      requestedByTelegramId: 111111,
      requestedByName: "Selamawit Tadesse",
      requestedAt: new Date().toISOString(),
      status: "Pending",
    };

    const count = await sendStockAdjustmentAlertToManagers(
      mockBotApi,
      [999999],
      adjustment
    );

    expect(count).toBe(1);
    expect(mockBotApi.api.sendMessage).toHaveBeenCalledWith(
      999999,
      expect.stringContaining("YC345GF"),
      expect.objectContaining({
        parse_mode: "Markdown",
        reply_markup: expect.objectContaining({
          inline_keyboard: expect.arrayContaining([
            expect.arrayContaining([
              expect.objectContaining({ callback_data: "stock_appr:req_xyz123" }),
              expect.objectContaining({ callback_data: "stock_rej:req_xyz123" }),
            ]),
          ]),
        }),
      })
    );

    // Verify rich detail text includes current stock, proposed new stock, requester name, and reason
    const sentText = mockBotApi.api.sendMessage.mock.calls[0][1];
    expect(sentText).toContain("Current Stock:* 4 units");
    expect(sentText).toContain("Adjustment:* +2 units");
    expect(sentText).toContain("Proposed New Stock:* 6 units");
    expect(sentText).toContain("Requested by:* Selamawit Tadesse");
    expect(sentText).toContain("Reason / Note:* New shipment arrived from Akaki customs");
  });

  it("approves pending adjustment via callback query when triggered by manager", async () => {
    mockSalesRepsService.isManager.mockResolvedValue(true);
    mockSalesRepsService.findSalesRepByTelegramId.mockResolvedValue({
      fullName: "Daniel Mekonnen",
      role: "Manager",
    });

    const pendingAdjustment: PendingStockAdjustment = {
      requestId: "req_appr_1",
      itemId: "item-1",
      itemCode: "YC345GF",
      productName: "SILENT DIESEL GENERATOR SET YC345GF",
      currentStock: 4,
      delta: 2,
      newStock: 6,
      unitPrice: 1850000,
      reason: "Restock",
      requestedByTelegramId: 111111,
      requestedByName: "Selamawit Tadesse",
      requestedAt: new Date().toISOString(),
      status: "Pending",
    };

    mockInventoryService.getPendingAdjustment.mockReturnValue(pendingAdjustment);
    mockInventoryService.approveAdjustment.mockResolvedValue({
      ...pendingAdjustment,
      quantityInStock: 6,
    });

    const mockCtx = {
      callbackQuery: { data: "stock_appr:req_appr_1" },
      from: { id: 999999 },
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      editMessageText: vi.fn().mockResolvedValue(true),
    };

    // Find and invoke the callback_query handler
    const callbackHandler = (bot as any).handlers?.find(
      (h: any) => h.filter?.toString().includes("callback_query")
    )?.handler || (bot as any).registeredCallbackHandler;

    // Provide mock botInfo so GrammY does not require network init
    bot.botInfo = {
      id: 123456,
      is_bot: true,
      first_name: "TestBot",
      username: "test_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    // Simulate bot callback execution directly
    await bot.handleUpdate({
      update_id: 1,
      callback_query: {
        id: "cb_1",
        from: { id: 999999, is_bot: false, first_name: "Daniel" },
        data: "stock_appr:req_appr_1",
        chat_instance: "inst_1",
      },
    });

    expect(mockInventoryService.approveAdjustment).toHaveBeenCalledWith("req_appr_1", "Daniel Mekonnen");
  });
});


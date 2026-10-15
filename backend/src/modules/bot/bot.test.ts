import { describe, it, expect, vi } from "vitest";
import { createBot } from "./bot.js";
import { SalesRepsService } from "../notion/salesRepsService.js";
import type { ResilientNotionClient } from "../notion/notionClient.js";

describe("GrammY Bot Module", () => {
  it("initializes a Bot instance with configured handlers", () => {
    const mockNotionClient: Partial<ResilientNotionClient> = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
      updatePage: vi.fn(),
    };
    const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");

    const bot = createBot({
      token: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
      salesRepsService,
      managerChatIds: [999001],
    });

    expect(bot).toBeDefined();
    expect(bot.token).toBe("123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ");
    expect(typeof bot.start).toBe("function");
    expect(typeof bot.stop).toBe("function");
  });

  it("handles /weekly_report command successfully when reportsService is set via setBotReportsService", async () => {
    const mockNotionClient: Partial<ResilientNotionClient> = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
      updatePage: vi.fn(),
    };
    const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");

    const { setBotReportsService } = await import("./bot.js");
    const mockReportsService = {
      generateWeeklyReport: vi.fn().mockResolvedValue({
        reportPageId: "mock_page_id",
        reportUrl: "https://notion.so/mock_report",
        reportTitle: "Weekly Sales Report",
        periodString: "October 1 – October 8, 2026",
        totalWonRevenue: 250000,
        dealsWonCount: 3,
        dealsLostCount: 1,
        activePipelineCount: 8,
        newAccountsCount: 5,
        managersNotified: 1,
      }),
    };
    setBotReportsService(mockReportsService as any);

    const bot = createBot({
      token: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
      salesRepsService,
      managerChatIds: [999001],
    });

    bot.botInfo = {
      id: 123456789,
      is_bot: true,
      first_name: "TestBot",
      username: "test_sales_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const sentMessages: string[] = [];
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "sendMessage") {
        sentMessages.push(payload.text);
        return { ok: true, result: { message_id: 123, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    await bot.handleUpdate({
      update_id: 1001,
      message: {
        message_id: 55,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 999001, type: "private" },
        from: { id: 999001, is_bot: false, first_name: "Manager" },
        text: "/weekly_report",
        entities: [{ offset: 0, length: 14, type: "bot_command" }],
      },
    });

    expect(mockReportsService.generateWeeklyReport).toHaveBeenCalledWith({ triggerSource: "bot" });
    expect(sentMessages.length).toBe(2);
    expect(sentMessages[0]).toContain("Compiling Weekly Executive Sales Performance Report");
    expect(sentMessages[1]).toContain("Weekly Executive Sales Performance Report Compiled");
    expect(sentMessages[1]).toContain("https://notion.so/mock_report");
  });

  it("strictly rejects /weekly_report command from non-manager users", async () => {
    const mockNotionClient: Partial<ResilientNotionClient> = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
      updatePage: vi.fn(),
    };
    const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");
    vi.spyOn(salesRepsService, "findSalesRepByTelegramId").mockResolvedValue({
      pageId: "rep_page_1",
      telegramId: "888001",
      fullName: "Sales Rep Abebe",
      role: "Sales Rep",
      status: "Active",
      phone: "+251911000000",
    } as any);

    const bot = createBot({
      token: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
      salesRepsService,
      managerChatIds: [999001],
    });

    bot.botInfo = {
      id: 123456789,
      is_bot: true,
      first_name: "TestBot",
      username: "test_sales_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const sentMessages: string[] = [];
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "sendMessage") {
        sentMessages.push(payload.text);
        return { ok: true, result: { message_id: 124, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    await bot.handleUpdate({
      update_id: 1002,
      message: {
        message_id: 56,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 888001, type: "private" },
        from: { id: 888001, is_bot: false, first_name: "SalesRep" },
        text: "/weekly_report",
        entities: [{ offset: 0, length: 14, type: "bot_command" }],
      },
    });

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0]).toContain("Permission Denied: Weekly executive reports can only be generated by authorized Executive Managers");
  });

  it("omits /weekly_report in /help command for regular sales reps and displays it for managers", async () => {
    const mockNotionClient: Partial<ResilientNotionClient> = {
      queryDatabase: vi.fn(),
      createPage: vi.fn(),
      updatePage: vi.fn(),
    };
    const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");
    vi.spyOn(salesRepsService, "findSalesRepByTelegramId").mockResolvedValue({
      pageId: "rep_page_2",
      telegramId: "888002",
      fullName: "Regular Rep",
      role: "Sales Rep",
      status: "Active",
      phone: "+251911000000",
    } as any);

    const bot = createBot({
      token: "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
      salesRepsService,
      managerChatIds: [999001],
    });

    bot.botInfo = {
      id: 123456789,
      is_bot: true,
      first_name: "TestBot",
      username: "test_sales_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    };

    const sentMessages: string[] = [];
    bot.api.config.use(async (prev, method, payload: any) => {
      if (method === "sendMessage") {
        sentMessages.push(payload.text);
        return { ok: true, result: { message_id: 125, chat: { id: payload.chat_id } } } as any;
      }
      return prev(method, payload);
    });

    // 1. Regular Rep sends /help
    await bot.handleUpdate({
      update_id: 1003,
      message: {
        message_id: 57,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 888002, type: "private" },
        from: { id: 888002, is_bot: false, first_name: "Regular Rep" },
        text: "/help",
        entities: [{ offset: 0, length: 5, type: "bot_command" }],
      },
    });

    // 2. Manager sends /help
    await bot.handleUpdate({
      update_id: 1004,
      message: {
        message_id: 58,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 999001, type: "private" },
        from: { id: 999001, is_bot: false, first_name: "Manager" },
        text: "/help",
        entities: [{ offset: 0, length: 5, type: "bot_command" }],
      },
    });

    expect(sentMessages.length).toBe(2);
    // Regular rep should NOT see /weekly_report in /help
    expect(sentMessages[0]).not.toContain("/weekly_report");
    expect(sentMessages[0]).toContain("/start");
    expect(sentMessages[0]).toContain("/app");

    // Manager MUST see /weekly_report in /help
    expect(sentMessages[1]).toContain("/weekly_report");
  });
});

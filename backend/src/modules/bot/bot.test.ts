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

    const mockBotInfo: any = {
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
    bot.botInfo = mockBotInfo;

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
        chat: { id: 999001, type: "private" } as any,
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
    } as any;

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
        chat: { id: 888001, type: "private" } as any,
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
    } as any;

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
        chat: { id: 888002, type: "private" } as any,
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
        chat: { id: 999001, type: "private" } as any,
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

  describe("/checktin command", () => {
    it("reports 'Available. Register this account by heading to the app.' when TIN is available", async () => {
      const mockNotionClient: Partial<ResilientNotionClient> = {
        queryDatabase: vi.fn(),
        createPage: vi.fn(),
        updatePage: vi.fn(),
      };
      const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");
      vi.spyOn(salesRepsService, "findSalesRepByTelegramId").mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "888001",
        fullName: "Active Rep",
        role: "Sales Rep",
        status: "Active",
      } as any);

      const { setBotLeadsService } = await import("./bot.js");
      const mockLeadsService = {
        checkTin: vi.fn().mockResolvedValue({ available: true }),
      };
      setBotLeadsService(mockLeadsService as any);

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
      } as any;

      const sentMessages: string[] = [];
      bot.api.config.use(async (prev, method, payload: any) => {
        if (method === "sendMessage") {
          sentMessages.push(payload.text);
          return { ok: true, result: { message_id: 126, chat: { id: payload.chat_id } } } as any;
        }
        return prev(method, payload);
      });

      await bot.handleUpdate({
        update_id: 1005,
        message: {
          message_id: 59,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 888001, type: "private" } as any,
          from: { id: 888001, is_bot: false, first_name: "Active Rep" },
          text: "/checktin 0012345678",
          entities: [{ offset: 0, length: 9, type: "bot_command" }],
        },
      });

      expect(mockLeadsService.checkTin).toHaveBeenCalledWith("0012345678");
      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0]).toContain("Available. Register this account by heading to the app.");
    });

    it("reports 'Not available.' without revealing sales rep name when non-manager checks a taken TIN", async () => {
      const mockNotionClient: Partial<ResilientNotionClient> = {
        queryDatabase: vi.fn(),
        createPage: vi.fn(),
        updatePage: vi.fn(),
      };
      const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");
      vi.spyOn(salesRepsService, "findSalesRepByTelegramId").mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "888001",
        fullName: "Active Rep",
        role: "Sales Rep",
        status: "Active",
      } as any);

      const { setBotLeadsService } = await import("./bot.js");
      const mockLeadsService = {
        checkTin: vi.fn().mockResolvedValue({
          available: false,
          conflict: {
            companyName: "Acme Corp",
            assignedRepName: "Daniel Mekonnen",
          },
        }),
      };
      setBotLeadsService(mockLeadsService as any);

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
      } as any;

      const sentMessages: string[] = [];
      bot.api.config.use(async (prev, method, payload: any) => {
        if (method === "sendMessage") {
          sentMessages.push(payload.text);
          return { ok: true, result: { message_id: 127, chat: { id: payload.chat_id } } } as any;
        }
        return prev(method, payload);
      });

      await bot.handleUpdate({
        update_id: 1006,
        message: {
          message_id: 60,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 888001, type: "private" } as any,
          from: { id: 888001, is_bot: false, first_name: "Active Rep" },
          text: "/checktin 0012345678",
          entities: [{ offset: 0, length: 9, type: "bot_command" }],
        },
      });

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0]).toBe("Not available.");
      expect(sentMessages[0]).not.toContain("Taken by");
      expect(sentMessages[0]).not.toContain("Daniel Mekonnen");
    });

    it("reports 'Not available. Taken by <Sales person name>.' when an authorized manager checks a taken TIN", async () => {
      const mockNotionClient: Partial<ResilientNotionClient> = {
        queryDatabase: vi.fn(),
        createPage: vi.fn(),
        updatePage: vi.fn(),
      };
      const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");
      vi.spyOn(salesRepsService, "findSalesRepByTelegramId").mockResolvedValue({
        pageId: "rep_mgr",
        telegramId: "999001",
        fullName: "Executive Manager",
        role: "Manager",
        status: "Active",
      } as any);

      const { setBotLeadsService } = await import("./bot.js");
      const mockLeadsService = {
        checkTin: vi.fn().mockResolvedValue({
          available: false,
          conflict: {
            companyName: "Acme Corp",
            assignedRepName: "Daniel Mekonnen",
          },
        }),
      };
      setBotLeadsService(mockLeadsService as any);

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
      } as any;

      const sentMessages: string[] = [];
      bot.api.config.use(async (prev, method, payload: any) => {
        if (method === "sendMessage") {
          sentMessages.push(payload.text);
          return { ok: true, result: { message_id: 128, chat: { id: payload.chat_id } } } as any;
        }
        return prev(method, payload);
      });

      await bot.handleUpdate({
        update_id: 1007,
        message: {
          message_id: 61,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 999001, type: "private" } as any,
          from: { id: 999001, is_bot: false, first_name: "Manager" },
          text: "/checktin 0012345678",
          entities: [{ offset: 0, length: 9, type: "bot_command" }],
        },
      });

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0]).toBe("Not available. Taken by Daniel Mekonnen.");
    });

    it("prompts for 10-digit TIN format if arguments are missing or invalid", async () => {
      const mockNotionClient: Partial<ResilientNotionClient> = {
        queryDatabase: vi.fn(),
        createPage: vi.fn(),
        updatePage: vi.fn(),
      };
      const salesRepsService = new SalesRepsService(mockNotionClient as ResilientNotionClient, "test_db");
      vi.spyOn(salesRepsService, "findSalesRepByTelegramId").mockResolvedValue({
        pageId: "rep_p1",
        telegramId: "888001",
        fullName: "Active Rep",
        role: "Sales Rep",
        status: "Active",
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
      } as any;

      const sentMessages: string[] = [];
      bot.api.config.use(async (prev, method, payload: any) => {
        if (method === "sendMessage") {
          sentMessages.push(payload.text);
          return { ok: true, result: { message_id: 128, chat: { id: payload.chat_id } } } as any;
        }
        return prev(method, payload);
      });

      await bot.handleUpdate({
        update_id: 1007,
        message: {
          message_id: 61,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 888001, type: "private" } as any,
          from: { id: 888001, is_bot: false, first_name: "Active Rep" },
          text: "/checktin 12345",
          entities: [{ offset: 0, length: 9, type: "bot_command" }],
        },
      });

      expect(sentMessages.length).toBe(1);
      expect(sentMessages[0]).toContain("must be exactly 10 numeric digits");
    });
  });
});

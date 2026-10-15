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
});

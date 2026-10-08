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
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingController } from "./onboarding.js";
import type { SalesRepsService, SalesRepRecord } from "../notion/salesRepsService.js";

function createMockContext(params: {
  userId: number;
  text?: string;
  contact?: { phone_number: string };
  callbackData?: string;
}) {
  const replies: Array<{ text: string; other?: any }> = [];
  const editedMessages: Array<{ text: string; other?: any }> = [];
  const answeredCallbacks: string[] = [];

  const ctx: any = {
    from: { id: params.userId, first_name: "TestUser" },
    chat: { id: params.userId },
    message: {
      text: params.text,
      contact: params.contact,
    },
    callbackQuery: params.callbackData ? { data: params.callbackData } : undefined,
    reply: vi.fn(async (text: string, other?: any) => {
      replies.push({ text, other });
      return { message_id: 101 };
    }),
    editMessageText: vi.fn(async (text: string, other?: any) => {
      editedMessages.push({ text, other });
      return true;
    }),
    answerCallbackQuery: vi.fn(async (text?: string) => {
      if (text) answeredCallbacks.push(text);
      return true;
    }),
    api: {
      sendMessage: vi.fn(async (chatId: number | string, text: string, other?: any) => {
        return { message_id: 202, chat: { id: chatId }, text };
      }),
    },
  };

  return { ctx, replies, editedMessages, answeredCallbacks };
}

describe("Telegram Bot Rep Onboarding Workflow", () => {
  let mockSalesRepsService: Partial<SalesRepsService>;
  let controller: OnboardingController;
  const managerChatIds = [999001];

  beforeEach(() => {
    mockSalesRepsService = {
      findSalesRepByTelegramId: vi.fn(),
      createSalesRep: vi.fn(),
      updateSalesRepStatus: vi.fn(),
    };
    controller = new OnboardingController({
      salesRepsService: mockSalesRepsService as SalesRepsService,
      managerChatIds,
      miniAppUrl: "https://t.me/TestBot/app",
    });
  });

  describe("handleStart", () => {
    it("greets Active rep and provides Mini App access", async () => {
      const activeRep: SalesRepRecord = {
        pageId: "page_1",
        telegramId: "111",
        fullName: "Abebe Bikila",
        phone: "+251911000000",
        role: "Sales Rep",
        status: "Active",
      };
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(activeRep);

      const { ctx, replies } = createMockContext({ userId: 111, text: "/start" });
      await controller.handleStart(ctx);

      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/Welcome back, Abebe Bikila/i);
      expect(replies[0]?.text).toMatch(/Active/i);
    });

    it("informs Pending rep their approval is in progress", async () => {
      const pendingRep: SalesRepRecord = {
        pageId: "page_2",
        telegramId: "222",
        fullName: "Bethlehem Tadesse",
        phone: "+251912000000",
        role: "Front Desk",
        status: "Pending Approval",
      };
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(pendingRep);

      const { ctx, replies } = createMockContext({ userId: 222, text: "/start" });
      await controller.handleStart(ctx);

      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/pending manager approval/i);
    });

    it("informs Inactive rep their account is deactivated", async () => {
      const inactiveRep: SalesRepRecord = {
        pageId: "page_3",
        telegramId: "333",
        fullName: "Dawit Kebede",
        phone: "+251913000000",
        role: "Sales Rep",
        status: "Inactive",
      };
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(inactiveRep);

      const { ctx, replies } = createMockContext({ userId: 333, text: "/start" });
      await controller.handleStart(ctx);

      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/account is inactive/i);
    });

    it("initiates onboarding for unregistered user by asking for Full Name", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(null);

      const { ctx, replies } = createMockContext({ userId: 444, text: "/start" });
      await controller.handleStart(ctx);

      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/Full Name/i);
      expect(controller.getSession(444).step).toBe("AWAITING_NAME");
    });
  });

  describe("Onboarding conversation progression", () => {
    it("handles Full Name submission and asks for Phone", async () => {
      (mockSalesRepsService.findSalesRepByTelegramId as any).mockResolvedValue(null);
      controller.setSession(555, { step: "AWAITING_NAME" });

      const { ctx, replies } = createMockContext({ userId: 555, text: "Samuel Yohannes" });
      await controller.handleMessage(ctx);

      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/Phone Number/i);
      expect(controller.getSession(555).step).toBe("AWAITING_PHONE");
      expect(controller.getSession(555).fullName).toBe("Samuel Yohannes");
    });

    it("handles Phone submission via contact sharing and asks for Role", async () => {
      controller.setSession(555, {
        step: "AWAITING_PHONE",
        fullName: "Samuel Yohannes",
      });

      const { ctx, replies } = createMockContext({
        userId: 555,
        contact: { phone_number: "+251914567890" },
      });
      await controller.handleMessage(ctx);

      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/Role/i);
      expect(controller.getSession(555).step).toBe("AWAITING_ROLE");
      expect(controller.getSession(555).phone).toBe("+251914567890");
    });

    it("handles Phone submission via text and asks for Role", async () => {
      controller.setSession(555, {
        step: "AWAITING_PHONE",
        fullName: "Samuel Yohannes",
      });

      const { ctx, replies } = createMockContext({
        userId: 555,
        text: "+251914567890",
      });
      await controller.handleMessage(ctx);

      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/Role/i);
      expect(controller.getSession(555).step).toBe("AWAITING_ROLE");
      expect(controller.getSession(555).phone).toBe("+251914567890");
    });

    it("handles Role selection, creates Notion record, and alerts Managers", async () => {
      controller.setSession(555, {
        step: "AWAITING_ROLE",
        fullName: "Samuel Yohannes",
        phone: "+251914567890",
      });

      const createdRecord: SalesRepRecord = {
        pageId: "page_new_555",
        telegramId: "555",
        fullName: "Samuel Yohannes",
        phone: "+251914567890",
        role: "Sales Rep",
        status: "Pending Approval",
      };
      (mockSalesRepsService.createSalesRep as any).mockResolvedValue(createdRecord);

      const { ctx, replies } = createMockContext({
        userId: 555,
        callbackData: "onboard_role:Sales Rep",
      });
      await controller.handleCallbackQuery(ctx);

      // Verifies record created
      expect(mockSalesRepsService.createSalesRep).toHaveBeenCalledWith({
        telegramId: "555",
        fullName: "Samuel Yohannes",
        phone: "+251914567890",
        role: "Sales Rep",
      });

      // Verifies user notified
      expect(replies.length).toBe(1);
      expect(replies[0]?.text).toMatch(/Registration submitted/i);

      // Verifies manager alerted
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        999001,
        expect.stringMatching(/New Rep Registration Pending Approval/i),
        expect.objectContaining({
          reply_markup: expect.anything(),
        })
      );

      // Session reset to IDLE
      expect(controller.getSession(555).step).toBe("IDLE");
    });
  });

  describe("Manager approval callbacks", () => {
    it("handles Manager approval: updates Notion and notifies applicant", async () => {
      (mockSalesRepsService.updateSalesRepStatus as any).mockResolvedValue(undefined);

      const { ctx, editedMessages } = createMockContext({
        userId: 999001, // Manager
        callbackData: "mgr_approve:page_new_555:555",
      });

      await controller.handleCallbackQuery(ctx);

      expect(mockSalesRepsService.updateSalesRepStatus).toHaveBeenCalledWith(
        "page_new_555",
        "Active"
      );
      expect(editedMessages.length).toBe(1);
      expect(editedMessages[0]?.text).toMatch(/Approved/i);

      // Applicant alerted
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        555,
        expect.stringMatching(/registration has been approved/i)
      );
    });

    it("handles Manager rejection: updates Notion and notifies applicant", async () => {
      (mockSalesRepsService.updateSalesRepStatus as any).mockResolvedValue(undefined);

      const { ctx, editedMessages } = createMockContext({
        userId: 999001, // Manager
        callbackData: "mgr_reject:page_new_555:555",
      });

      await controller.handleCallbackQuery(ctx);

      expect(mockSalesRepsService.updateSalesRepStatus).toHaveBeenCalledWith(
        "page_new_555",
        "Inactive"
      );
      expect(editedMessages.length).toBe(1);
      expect(editedMessages[0]?.text).toMatch(/Rejected/i);

      // Applicant alerted
      expect(ctx.api.sendMessage).toHaveBeenCalledWith(
        555,
        expect.stringMatching(/rejected/i)
      );
    });
  });
});

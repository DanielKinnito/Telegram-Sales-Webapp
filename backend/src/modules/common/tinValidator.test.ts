import { describe, it, expect } from "vitest";
import { isValidTin, sanitizeTin, tinSchema } from "./tinValidator.js";

describe("TIN Validator (10-digit rule)", () => {
  it("accepts valid 10-digit numeric TINs", () => {
    expect(isValidTin("1234567890")).toBe(true);
    expect(isValidTin("0012345678")).toBe(true);
    expect(isValidTin("9876543210")).toBe(true);
  });

  it("accepts valid 10-digit TINs with surrounding whitespace after sanitizing", () => {
    expect(isValidTin(sanitizeTin("  1234567890  "))).toBe(true);
  });

  it("rejects TINs with fewer than 10 digits", () => {
    expect(isValidTin("123456789")).toBe(false); // 9 digits
    expect(isValidTin("123")).toBe(false);
    expect(isValidTin("")).toBe(false);
  });

  it("rejects TINs with more than 10 digits", () => {
    expect(isValidTin("12345678901")).toBe(false); // 11 digits
    expect(isValidTin("123456789012345")).toBe(false);
  });

  it("rejects TINs containing non-digit characters", () => {
    expect(isValidTin("12345ABCDE")).toBe(false);
    expect(isValidTin("123-456-789")).toBe(false);
    expect(isValidTin("1234 567890")).toBe(false);
    expect(isValidTin("12345.6789")).toBe(false);
  });

  describe("tinSchema (Zod)", () => {
    it("successfully parses valid 10-digit string", () => {
      const parsed = tinSchema.parse("1234567890");
      expect(parsed).toBe("1234567890");
    });

    it("trims whitespace during parsing", () => {
      const parsed = tinSchema.parse("  1234567890 \t");
      expect(parsed).toBe("1234567890");
    });

    it("throws descriptive error for invalid TIN length or format", () => {
      expect(() => tinSchema.parse("12345")).toThrow(/10 numeric digits/i);
      expect(() => tinSchema.parse("12345678901")).toThrow(/10 numeric digits/i);
      expect(() => tinSchema.parse("abcdefghij")).toThrow(/10 numeric digits/i);
    });
  });
});

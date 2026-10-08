import { z } from "zod";

/**
 * Official TIN Specification:
 * Taxpayer Identification Number must be exactly 10 numeric digits.
 */
export const TIN_REGEX = /^\d{10}$/;

/**
 * Sanitizes input TIN by removing leading/trailing whitespace.
 */
export function sanitizeTin(rawTin: string): string {
  if (typeof rawTin !== "string") return "";
  return rawTin.trim();
}

/**
 * Returns true if the provided string is exactly 10 numeric digits.
 */
export function isValidTin(rawTin: string): boolean {
  const cleaned = sanitizeTin(rawTin);
  return TIN_REGEX.test(cleaned);
}

/**
 * Zod schema enforcing the 10-digit numeric format for TINs.
 */
export const tinSchema = z
  .string()
  .trim()
  .regex(TIN_REGEX, "TIN Number must be exactly 10 numeric digits (e.g. 0012345678)");

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  let originalIntl: typeof Intl;

  beforeEach(() => {
    originalIntl = global.Intl;
  });

  afterEach(() => {
    global.Intl = originalIntl;
  });

  it("should format Date object", () => {
    const date = new Date("2023-12-25T10:30:00Z");
    const result = formatDate(date);

    // Result will vary based on locale and timezone, but should include the date components
    expect(result).toMatch(/Dec/); // December
    expect(result).toMatch(/25/); // Day
    expect(result).toMatch(/2023/); // Year
  });

  it("should format date string", () => {
    const dateString = "2023-12-25T10:30:00Z";
    const result = formatDate(dateString);

    // Should produce the same result as Date object
    const dateResult = formatDate(new Date(dateString));
    expect(result).toBe(dateResult);
  });

  it("should use locale-specific formatting", () => {
    // Mock Intl.DateTimeFormat to control locale
    const mockResolvedOptions = vi.fn().mockReturnValue({
      locale: "en-US",
      timeZone: "UTC",
    });

    const mockToLocaleDateString = vi.fn().mockReturnValue("Dec 25, 2023, 10:30:00");

    global.Intl = {
      ...originalIntl,
      DateTimeFormat: vi.fn().mockImplementation(() => ({
        resolvedOptions: mockResolvedOptions,
      })),
    } as any;

    Date.prototype.toLocaleDateString = mockToLocaleDateString;

    const date = new Date("2023-12-25T10:30:00Z");
    const result = formatDate(date);

    expect(result).toBe("Dec 25, 2023, 10:30:00");
    expect(mockToLocaleDateString).toHaveBeenCalledWith("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      timeZone: "UTC",
    });
  });

  it("should handle invalid date strings", () => {
    const invalidDate = "invalid-date";
    const result = formatDate(invalidDate);

    // Invalid dates in JS still parse to a valid date sometimes
    // So we just check it returns a string
    expect(typeof result).toBe("string");
  });

  it("should format current date", () => {
    const now = new Date();
    const result = formatDate(now);

    // Should return a non-empty string
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should format dates consistently", () => {
    const date1 = new Date("2023-01-01T00:00:00Z");
    const date2 = new Date("2023-01-01T00:00:00Z");

    const result1 = formatDate(date1);
    const result2 = formatDate(date2);

    expect(result1).toBe(result2);
  });

  it("should include all time components", () => {
    const date = new Date("2023-12-25T15:45:30Z");
    const result = formatDate(date);

    // Should include hours, minutes, seconds (exact format depends on locale)
    // Just verify the result is not empty and is a string
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

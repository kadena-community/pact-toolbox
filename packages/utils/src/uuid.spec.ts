import { describe, it, expect, vi } from "vitest";
import { nanoid, getUuid } from "./uuid";

describe("uuid utilities", () => {
  describe("nanoid", () => {
    it("should generate ID of default length", () => {
      const id = nanoid();
      expect(id).toHaveLength(21);
    });

    it("should generate ID of custom length", () => {
      const id = nanoid(10);
      expect(id).toHaveLength(10);
    });

    it("should generate URL-safe IDs", () => {
      const id = nanoid();
      // URL-safe characters: alphanumeric, -, _
      expect(id).toMatch(/^[a-zA-Z0-9\-_]+$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(nanoid());
      }
      expect(ids.size).toBe(100);
    });

    it("should use crypto.getRandomValues", () => {
      const mockGetRandomValues = vi.fn().mockImplementation((arr) => {
        // Fill with predictable values for testing
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i % 256;
        }
        return arr;
      });

      vi.stubGlobal("crypto", {
        getRandomValues: mockGetRandomValues,
      });

      nanoid(10);

      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.objectContaining({ length: 10 }));

      vi.unstubAllGlobals();
    });
  });

  describe("getUuid", () => {
    it("should generate valid UUID v4 format", () => {
      const uuid = getUuid();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it("should use crypto.randomUUID when available", () => {
      const mockRandomUUID = vi.fn().mockReturnValue("550e8400-e29b-41d4-a716-446655440000");

      vi.stubGlobal("crypto", {
        randomUUID: mockRandomUUID,
        getRandomValues: crypto.getRandomValues, // Keep original for fallback
      });

      const uuid = getUuid();

      expect(mockRandomUUID).toHaveBeenCalled();
      expect(uuid).toBe("550e8400-e29b-41d4-a716-446655440000");

      vi.unstubAllGlobals();
    });

    it("should fall back to nanoid when crypto.randomUUID is not available", () => {
      const mockGetRandomValues = vi.fn().mockImplementation((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      });

      vi.stubGlobal("crypto", {
        getRandomValues: mockGetRandomValues,
        // randomUUID is intentionally omitted
      });

      const uuid = getUuid();

      expect(mockGetRandomValues).toHaveBeenCalled();
      expect(uuid).toHaveLength(21); // nanoid default length

      vi.unstubAllGlobals();
    });

    it("should use fallback when crypto is undefined", () => {
      const originalCrypto = global.crypto;
      // @ts-ignore - Testing runtime behavior
      delete global.crypto;

      const uuid = getUuid();

      // Fallback should generate UUID-like format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);

      global.crypto = originalCrypto;
    });

    it("should generate unique UUIDs", () => {
      const uuids = new Set();
      for (let i = 0; i < 100; i++) {
        uuids.add(getUuid());
      }
      expect(uuids.size).toBe(100);
    });
  });

  describe("fallback UUID generation", () => {
    it("should generate valid UUID format in fallback", () => {
      const originalCrypto = global.crypto;
      // @ts-ignore - Testing runtime behavior
      delete global.crypto;

      // Generate multiple UUIDs to ensure randomness
      for (let i = 0; i < 10; i++) {
        const uuid = getUuid();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(uuid).toMatch(uuidRegex);

        // Check version bits (should be 4xxx)
        expect(uuid[14]).toBe("4");

        // Check variant bits (should be 8, 9, a, or b)
        expect(["8", "9", "a", "b"]).toContain(uuid[19].toLowerCase());
      }

      global.crypto = originalCrypto;
    });
  });
});

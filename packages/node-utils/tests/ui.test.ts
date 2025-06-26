import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as clackPrompts from "@clack/prompts";
import { box, colors } from "consola/utils";
import {
  startSpinner,
  stopSpinner,
  updateSpinner,
  boxMessage,
  table,
  clear,
} from "../src/ui";

vi.mock("@clack/prompts");
vi.mock("consola/utils");

describe("ui", () => {
  let mockSpinner: any;
  let consoleSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock spinner
    mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    };
    
    vi.mocked(clackPrompts.spinner).mockReturnValue(mockSpinner);
    (vi.mocked(clackPrompts.log) as any).success = vi.fn();
    (vi.mocked(clackPrompts.log) as any).error = vi.fn();
    
    // Mock colors
    vi.mocked(colors.bold).mockImplementation((text: string | number) => `**${text}**`);
    vi.mocked(box).mockImplementation((content: string) => `[BOX]\n${content}\n[/BOX]`);
    
    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      clear: vi.spyOn(console, "clear").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.clear.mockRestore();
  });

  describe("spinner management", () => {
    it("should start a new spinner", () => {
      const spinner = startSpinner("Loading...");

      expect(clackPrompts.spinner).toHaveBeenCalled();
      expect(mockSpinner.start).toHaveBeenCalledWith("Loading...");
      expect(spinner).toBe(mockSpinner);
    });

    it("should stop previous spinner when starting new one", () => {
      const spinner1 = startSpinner("First spinner");
      const spinner2 = startSpinner("Second spinner");

      expect(spinner1.stop).toHaveBeenCalled();
      expect(spinner2).toBe(mockSpinner);
      expect(mockSpinner.start).toHaveBeenCalledWith("Second spinner");
    });

    it("should stop spinner with success message", () => {
      startSpinner("Processing...");
      stopSpinner(true, "Done!");

      expect(mockSpinner.stop).toHaveBeenCalledWith("Done!");
      expect(clackPrompts.log.success).toHaveBeenCalledWith("Done!");
    });

    it("should stop spinner with error message", () => {
      startSpinner("Processing...");
      stopSpinner(false, "Failed!");

      expect(mockSpinner.stop).toHaveBeenCalledWith("Failed!");
      expect(clackPrompts.log.error).toHaveBeenCalledWith("Failed!");
    });

    it("should stop spinner without message", () => {
      startSpinner("Processing...");
      stopSpinner();

      expect(mockSpinner.stop).toHaveBeenCalledWith();
      expect(clackPrompts.log.success).not.toHaveBeenCalled();
      expect(clackPrompts.log.error).not.toHaveBeenCalled();
    });

    it("should handle stopping when no spinner is active", () => {
      expect(() => stopSpinner()).not.toThrow();
    });

    it("should update spinner message", () => {
      startSpinner("Initial message");
      updateSpinner("Updated message");

      expect(mockSpinner.message).toHaveBeenCalledWith("Updated message");
    });

    it("should handle updating when no spinner is active", () => {
      expect(() => updateSpinner("Message")).not.toThrow();
      expect(mockSpinner.message).not.toHaveBeenCalled();
    });

    it("should clear spinner reference after stopping", () => {
      startSpinner("Test");
      stopSpinner();
      
      // Try to update after stopping
      updateSpinner("Should not update");
      expect(mockSpinner.message).not.toHaveBeenCalledWith("Should not update");
    });
  });

  describe("boxMessage", () => {
    it("should display a boxed message with title", () => {
      boxMessage("Notice", "This is important");

      expect(colors.bold).toHaveBeenCalledWith("Notice");
      expect(box).toHaveBeenCalledWith("**Notice**\n\nThis is important");
      expect(consoleSpy.log).toHaveBeenCalledWith("[BOX]\n**Notice**\n\nThis is important\n[/BOX]");
    });

    it("should handle array of content lines", () => {
      boxMessage("Warning", ["Line 1", "Line 2", "Line 3"]);

      expect(box).toHaveBeenCalledWith("**Warning**\n\nLine 1\nLine 2\nLine 3");
    });

    it("should handle empty content", () => {
      boxMessage("Empty", []);

      expect(box).toHaveBeenCalledWith("**Empty**\n");
    });

    it("should handle single line as array", () => {
      boxMessage("Info", ["Single line"]);

      expect(box).toHaveBeenCalledWith("**Info**\n\nSingle line");
    });
  });

  describe("table", () => {
    it("should render a simple table", () => {
      table(["Name", "Age"], [["Alice", "30"], ["Bob", "25"]]);

      const calls = consoleSpy.log.mock.calls;
      
      // Check header
      expect(colors.bold).toHaveBeenCalled();
      expect(calls[0][0]).toContain("Name");
      expect(calls[0][0]).toContain("Age");
      
      // Check separator
      expect(calls[1][0]).toMatch(/^─+$/);
      
      // Check rows
      expect(calls[2][0]).toContain("Alice");
      expect(calls[2][0]).toContain("30");
      expect(calls[3][0]).toContain("Bob");
      expect(calls[3][0]).toContain("25");
    });

    it("should handle column width calculation", () => {
      table(
        ["Short", "Very Long Header Name"],
        [["A", "B"], ["Longer content here", "C"]]
      );

      const calls = consoleSpy.log.mock.calls;
      const headerRow = calls[0][0];
      const dataRow1 = calls[2][0];
      
      // Check that columns are properly padded
      expect(headerRow).toMatch(/Short\s+│\s+Very Long Header Name/);
      expect(dataRow1).toMatch(/A\s+│\s+B/);
    });

    it("should truncate long cell values", () => {
      const longText = "A".repeat(50);
      table(["Column"], [[longText]]);

      const calls = consoleSpy.log.mock.calls;
      const dataRow = calls[2][0];
      
      // Should truncate to 40 chars max with ellipsis
      expect(dataRow).toContain("...");
      expect(dataRow.length).toBeLessThan(longText.length);
    });

    it("should handle empty cells", () => {
      table(["A", "B", "C"], [["1", "", "3"], ["", "2", ""]]);

      const calls = consoleSpy.log.mock.calls;
      
      // Empty cells should be padded appropriately
      expect(calls[2][0]).toMatch(/1\s+│\s+│\s+3/);
      expect(calls[3][0]).toMatch(/\s+│\s+2\s+│/);
    });

    it("should handle mismatched row lengths", () => {
      table(["A", "B", "C"], [["1", "2"], ["3", "4", "5", "6"]]);

      // Should not throw
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("should use proper column separators", () => {
      table(["Col1", "Col2"], [["Val1", "Val2"]]);

      const calls = consoleSpy.log.mock.calls;
      
      // Check for │ separator
      expect(calls[0][0]).toContain(" │ ");
      expect(calls[2][0]).toContain(" │ ");
    });
  });

  describe("clear", () => {
    it("should clear the console", () => {
      clear();

      expect(consoleSpy.clear).toHaveBeenCalled();
    });

    it("should be callable multiple times", () => {
      clear();
      clear();
      clear();

      expect(consoleSpy.clear).toHaveBeenCalledTimes(3);
    });
  });
});
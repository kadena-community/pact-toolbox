import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "pathe";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import {
  ensureDir,
  writeFile,
  readFile,
  exists,
  existsSync,
  getStats,
  copyFile,
  removeFile,
  removeDir,
  calculateFileHash,
  calculateContentHash,
  glob,
  matchPattern,
} from "../src/filesystem";

describe("filesystem", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `node-utils-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("ensureDir", () => {
    it("should create a new directory", async () => {
      const dirPath = join(testDir, "new-dir");
      await ensureDir(dirPath);
      
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should create nested directories", async () => {
      const dirPath = join(testDir, "nested", "deep", "dir");
      await ensureDir(dirPath);
      
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should not throw if directory already exists", async () => {
      const dirPath = join(testDir, "existing-dir");
      await fs.mkdir(dirPath);
      
      await expect(ensureDir(dirPath)).resolves.not.toThrow();
    });
  });

  describe("writeFile", () => {
    it("should write content to a file", async () => {
      const filePath = join(testDir, "test.txt");
      const content = "Hello, World!";
      
      await writeFile(filePath, content);
      
      const readContent = await fs.readFile(filePath, "utf8");
      expect(readContent).toBe(content);
    });

    it("should create parent directories if they don't exist", async () => {
      const filePath = join(testDir, "nested", "dir", "test.txt");
      const content = "Test content";
      
      await writeFile(filePath, content);
      
      const readContent = await fs.readFile(filePath, "utf8");
      expect(readContent).toBe(content);
    });

    it("should trim content before writing", async () => {
      const filePath = join(testDir, "trim-test.txt");
      const content = "  Trimmed content  \n";
      
      await writeFile(filePath, content);
      
      const readContent = await fs.readFile(filePath, "utf8");
      expect(readContent).toBe("Trimmed content");
    });
  });

  describe("readFile", () => {
    it("should read file content", async () => {
      const filePath = join(testDir, "read-test.txt");
      const content = "File content to read";
      await fs.writeFile(filePath, content);
      
      const readContent = await readFile(filePath);
      expect(readContent).toBe(content);
    });

    it("should read file with different encoding", async () => {
      const filePath = join(testDir, "encoding-test.txt");
      const content = "UTF-16 content: 你好";
      await fs.writeFile(filePath, content, "utf16le");
      
      const readContent = await readFile(filePath, "utf16le");
      expect(readContent).toBe(content);
    });

    it("should throw if file doesn't exist", async () => {
      const filePath = join(testDir, "non-existent.txt");
      
      await expect(readFile(filePath)).rejects.toThrow();
    });
  });

  describe("exists and existsSync", () => {
    it("should return true for existing file", async () => {
      const filePath = join(testDir, "exists-test.txt");
      await fs.writeFile(filePath, "test");
      
      expect(await exists(filePath)).toBe(true);
      expect(existsSync(filePath)).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      const filePath = join(testDir, "non-existent.txt");
      
      expect(await exists(filePath)).toBe(false);
      expect(existsSync(filePath)).toBe(false);
    });

    it("should work with directories", async () => {
      const dirPath = join(testDir, "exists-dir");
      await fs.mkdir(dirPath);
      
      expect(await exists(dirPath)).toBe(true);
      expect(existsSync(dirPath)).toBe(true);
    });
  });

  describe("getStats", () => {
    it("should return file statistics", async () => {
      const filePath = join(testDir, "stats-test.txt");
      const content = "Test file for stats";
      await fs.writeFile(filePath, content);
      
      const stats = await getStats(filePath);
      
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBe(content.length);
    });

    it("should return directory statistics", async () => {
      const dirPath = join(testDir, "stats-dir");
      await fs.mkdir(dirPath);
      
      const stats = await getStats(dirPath);
      
      expect(stats.isDirectory()).toBe(true);
    });

    it("should throw for non-existent path", async () => {
      const filePath = join(testDir, "non-existent.txt");
      
      await expect(getStats(filePath)).rejects.toThrow();
    });
  });

  describe("copyFile", () => {
    it("should copy a file", async () => {
      const srcPath = join(testDir, "source.txt");
      const destPath = join(testDir, "destination.txt");
      const content = "Content to copy";
      
      await fs.writeFile(srcPath, content);
      await copyFile(srcPath, destPath);
      
      const copiedContent = await fs.readFile(destPath, "utf8");
      expect(copiedContent).toBe(content);
    });

    it("should copy to non-existent directory", async () => {
      const srcPath = join(testDir, "source.txt");
      const destPath = join(testDir, "new-dir", "destination.txt");
      const content = "Content to copy";
      
      await fs.writeFile(srcPath, content);
      await copyFile(srcPath, destPath);
      
      const copiedContent = await fs.readFile(destPath, "utf8");
      expect(copiedContent).toBe(content);
    });

    it("should copy directories recursively", async () => {
      const srcDir = join(testDir, "src-dir");
      const destDir = join(testDir, "dest-dir");
      const filePath = join(srcDir, "nested", "file.txt");
      
      await fs.mkdir(join(srcDir, "nested"), { recursive: true });
      await fs.writeFile(filePath, "nested content");
      
      await copyFile(srcDir, destDir);
      
      const copiedContent = await fs.readFile(join(destDir, "nested", "file.txt"), "utf8");
      expect(copiedContent).toBe("nested content");
    });
  });

  describe("removeFile and removeDir", () => {
    it("should remove a file", async () => {
      const filePath = join(testDir, "remove-test.txt");
      await fs.writeFile(filePath, "test");
      
      await removeFile(filePath);
      
      expect(await exists(filePath)).toBe(false);
    });

    it("should not throw if file doesn't exist", async () => {
      const filePath = join(testDir, "non-existent.txt");
      
      await expect(removeFile(filePath)).resolves.not.toThrow();
    });

    it("should remove a directory and its contents", async () => {
      const dirPath = join(testDir, "remove-dir");
      const filePath = join(dirPath, "file.txt");
      
      await fs.mkdir(dirPath);
      await fs.writeFile(filePath, "test");
      
      await removeDir(dirPath);
      
      expect(await exists(dirPath)).toBe(false);
    });

    it("should not throw if directory doesn't exist", async () => {
      const dirPath = join(testDir, "non-existent-dir");
      
      await expect(removeDir(dirPath)).resolves.not.toThrow();
    });
  });

  describe("hash functions", () => {
    it("should calculate file hash", async () => {
      const filePath = join(testDir, "hash-test.txt");
      const content = "Hash this content";
      await fs.writeFile(filePath, content);
      
      const hash = await calculateFileHash(filePath);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
      expect(hash).toBe(calculateContentHash(content));
    });

    it("should return empty string for non-existent file", async () => {
      const filePath = join(testDir, "non-existent.txt");
      
      const hash = await calculateFileHash(filePath);
      
      expect(hash).toBe("");
    });

    it("should calculate consistent content hashes", () => {
      const content = "Test content";
      
      const hash1 = calculateContentHash(content);
      const hash2 = calculateContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce different hashes for different content", () => {
      const hash1 = calculateContentHash("Content 1");
      const hash2 = calculateContentHash("Content 2");
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("glob and matchPattern", () => {
    beforeEach(async () => {
      // Create test file structure
      await fs.mkdir(join(testDir, "src"), { recursive: true });
      await fs.mkdir(join(testDir, "test"), { recursive: true });
      await fs.writeFile(join(testDir, "src", "index.ts"), "");
      await fs.writeFile(join(testDir, "src", "utils.ts"), "");
      await fs.writeFile(join(testDir, "test", "index.test.ts"), "");
      await fs.writeFile(join(testDir, "README.md"), "");
    });

    it("should match files with glob patterns", async () => {
      // Use the directory as the base and pattern as relative
      const result = await glob("**/*.ts", { cwd: testDir });
      
      expect(result.files).toHaveLength(3);
      // tiny-readdir-glob returns absolute paths when cwd is provided
      const paths = result.files.map(f => typeof f === 'string' ? f : (f as any).path);
      expect(paths).toContain(join(testDir, "src", "index.ts"));
      expect(paths).toContain(join(testDir, "src", "utils.ts"));
      expect(paths).toContain(join(testDir, "test", "index.test.ts"));
    });

    it("should match multiple patterns", async () => {
      const result = await glob(["**/*.ts", "**/*.md"], { cwd: testDir });
      
      expect(result.files).toHaveLength(4);
    });

    it("should exclude patterns with !", async () => {
      const result = await glob(["**/*.ts", "!**/*.test.ts"], { cwd: testDir });
      
      expect(result.files).toHaveLength(2);
      const paths = result.files.map(f => typeof f === 'string' ? f : (f as any).path);
      expect(paths).not.toContain(join(testDir, "test", "index.test.ts"));
    });

    it("should match patterns with matchPattern", () => {
      expect(matchPattern("src/index.ts", "**/*.ts")).toBe(true);
      expect(matchPattern("src/index.ts", "**/*.js")).toBe(false);
      expect(matchPattern("test/index.test.ts", "**/test/*.ts")).toBe(true);
      expect(matchPattern("src/utils.ts", "src/*.ts")).toBe(true);
    });
  });
});
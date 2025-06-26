/**
 * Unified file system utilities
 * Combines file operations, globbing, and path utilities
 */

import { mkdir, writeFile as _writeFile, access, readFile as _readFile, stat, rm, cp } from "node:fs/promises";
import { existsSync as _existsSync, Stats } from "node:fs";
import { dirname } from "pathe";
import readdir from "tiny-readdir-glob";
import { minimatch } from "minimatch";
import chokidar from "chokidar";
import { createHash } from "node:crypto";

// Re-export path utilities
export * from "pathe";

// Export only the functions we use from globbing libraries

/**
 * Reads directories recursively and returns files matching glob patterns.
 * Wrapper around tiny-readdir-glob for consistent API.
 * 
 * @example
 * ```typescript
 * const files = await glob(['src', 'lib/*.js']);
 * ```
 */
export const glob: typeof readdir = readdir;

/**
 * Watch files and directories for changes.
 * Wrapper around chokidar for file system watching.
 * 
 * @example
 * ```typescript
 * const watcher = watch('src/', {
 *   ignored: /node_modules/,
 *   persistent: true
 * });
 * 
 * watcher.on('change', (path) => {
 *   console.log(`File ${path} has been changed`);
 * });
 * ```
 */
export const watch: typeof chokidar.watch = chokidar.watch;

/**
 * Test if a file path matches a glob pattern.
 * Wrapper around minimatch for pattern matching.
 * 
 * @example
 * ```typescript
 * if (matchPattern('src/index.ts', '*.ts')) {
 *   console.log('This is a TypeScript file');
 * }
 * ```
 */
export const matchPattern: typeof minimatch = minimatch;

// File system operations

/**
 * Ensures a directory exists, creating it and any parent directories if necessary.
 * 
 * @param dirPath - The path to the directory
 * @throws {Error} If directory creation fails
 * 
 * @example
 * ```typescript
 * await ensureDir('/path/to/nested/directory');
 * ```
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!(await access(dirPath).catch(() => false))) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Writes content to a file, creating parent directories if they don't exist.
 * Content is automatically trimmed before writing.
 * 
 * @param filePath - The path to the file
 * @param content - The content to write
 * @throws {Error} If write operation fails
 * 
 * @example
 * ```typescript
 * await writeFile('/path/to/file.txt', 'Hello, World!');
 * ```
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await _writeFile(filePath, content.trim());
}

/**
 * Reads the content of a file as a string.
 * 
 * @param filePath - The path to the file
 * @param encoding - The encoding to use (default: 'utf8')
 * @returns The file content as a string
 * @throws {Error} If file doesn't exist or read operation fails
 * 
 * @example
 * ```typescript
 * const content = await readFile('/path/to/file.txt');
 * ```
 */
export async function readFile(filePath: string, encoding: BufferEncoding = "utf8"): Promise<string> {
  return _readFile(filePath, encoding);
}

/**
 * Synchronously checks if a file or directory exists.
 * 
 * @param filePath - The path to check
 * @returns true if the path exists, false otherwise
 * 
 * @example
 * ```typescript
 * if (existsSync('/path/to/file')) {
 *   console.log('File exists');
 * }
 * ```
 */
export function existsSync(filePath: string): boolean {
  return _existsSync(filePath);
}

/**
 * Asynchronously checks if a file or directory exists.
 * 
 * @param filePath - The path to check
 * @returns Promise resolving to true if the path exists, false otherwise
 * 
 * @example
 * ```typescript
 * if (await exists('/path/to/file')) {
 *   console.log('File exists');
 * }
 * ```
 */
export async function exists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

/**
 * Gets file or directory statistics.
 * 
 * @param filePath - The path to the file or directory
 * @returns File statistics object
 * @throws {Error} If the path doesn't exist
 * 
 * @example
 * ```typescript
 * const stats = await getStats('/path/to/file');
 * console.log(`File size: ${stats.size} bytes`);
 * console.log(`Is directory: ${stats.isDirectory()}`);
 * ```
 */
export async function getStats(filePath: string): Promise<Stats> {
  return stat(filePath);
}

/**
 * Copies a file or directory from source to destination.
 * Creates parent directories of destination if they don't exist.
 * 
 * @param src - The source path
 * @param dest - The destination path
 * @throws {Error} If copy operation fails
 * 
 * @example
 * ```typescript
 * await copyFile('/path/to/source.txt', '/path/to/dest.txt');
 * await copyFile('/path/to/source-dir', '/path/to/dest-dir');
 * ```
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(dirname(dest));
  await cp(src, dest, { recursive: true });
}

/**
 * Removes a file. Does not throw if the file doesn't exist.
 * 
 * @param filePath - The path to the file to remove
 * 
 * @example
 * ```typescript
 * await removeFile('/path/to/file.txt');
 * ```
 */
export async function removeFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}

/**
 * Removes a directory and all its contents. Does not throw if the directory doesn't exist.
 * 
 * @param dirPath - The path to the directory to remove
 * 
 * @example
 * ```typescript
 * await removeDir('/path/to/directory');
 * ```
 */
export async function removeDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true });
}

/**
 * Calculates the SHA-256 hash of a file's contents.
 * 
 * @param filePath - The path to the file
 * @returns The SHA-256 hash as a hex string, or empty string if file read fails
 * 
 * @example
 * ```typescript
 * const hash = await calculateFileHash('/path/to/file.txt');
 * console.log(`File hash: ${hash}`);
 * ```
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return "";
  }
}

/**
 * Calculates the SHA-256 hash of a string content.
 * 
 * @param content - The content to hash
 * @returns The SHA-256 hash as a hex string
 * 
 * @example
 * ```typescript
 * const hash = calculateContentHash('Hello, World!');
 * console.log(`Content hash: ${hash}`);
 * ```
 */
export function calculateContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

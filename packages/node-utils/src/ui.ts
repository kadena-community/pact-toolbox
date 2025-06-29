/**
 * Simplified UI utilities using @clack/prompts and consola
 */

import { spinner as clackSpinner, log as clackLog } from "@clack/prompts";
import { box, colors } from "consola/utils";

type ClackSpinner = ReturnType<typeof clackSpinner>;

// Spinner management
let currentSpinner: ClackSpinner | null = null;

// Spinner methods

/**
 * Starts a new spinner with the given text.
 * If a spinner is already running, it will be stopped first.
 *
 * @param text - The text to display with the spinner
 * @returns The spinner instance
 *
 * @example
 * ```typescript
 * const spinner = startSpinner('Loading...');
 * // Do some work
 * stopSpinner(true, 'Done!');
 * ```
 */
export function startSpinner(text: string): ClackSpinner {
  if (currentSpinner) {
    currentSpinner.stop();
  }
  currentSpinner = clackSpinner();
  currentSpinner.start(text);
  return currentSpinner;
}

/**
 * Stops the current spinner.
 *
 * @param success - Whether the operation was successful (affects log color)
 * @param text - Optional text to display when stopping
 *
 * @example
 * ```typescript
 * startSpinner('Processing...');
 * try {
 *   await doWork();
 *   stopSpinner(true, 'Processing complete!');
 * } catch (error) {
 *   stopSpinner(false, 'Processing failed!');
 * }
 * ```
 */
export function stopSpinner(success = true, text?: string): void {
  if (currentSpinner) {
    if (text) {
      currentSpinner.stop(text);
      // Also log the result
      if (success) {
        clackLog.success(text);
      } else {
        clackLog.error(text);
      }
    } else {
      currentSpinner.stop();
    }
    currentSpinner = null;
  }
}

/**
 * Updates the text of the current spinner.
 *
 * @param text - The new text to display
 *
 * @example
 * ```typescript
 * startSpinner('Processing item 1 of 10...');
 * for (let i = 1; i <= 10; i++) {
 *   updateSpinner(`Processing item ${i} of 10...`);
 *   await processItem(i);
 * }
 * stopSpinner(true, 'All items processed!');
 * ```
 */
export function updateSpinner(text: string): void {
  if (currentSpinner) {
    currentSpinner.message(text);
  }
}

// Box using consola utils

/**
 * Displays a message in a bordered box for emphasis.
 *
 * @param title - The title to display in bold
 * @param content - The content lines (string or array of strings)
 *
 * @example
 * ```typescript
 * boxMessage('Important Notice', [
 *   'Your configuration has been updated.',
 *   'Please restart the application.'
 * ]);
 * ```
 */
export function boxMessage(title: string, content: string | string[]): void {
  const lines = Array.isArray(content) ? content : [content];
  const boxContent = [colors.bold(title), "", ...lines].join("\n");
  console.log(box(boxContent));
}

// Simple table - since it's only used once, keep it minimal

/**
 * Displays data in a simple table format.
 * Long cell values are truncated with ellipsis.
 *
 * @param headers - The table headers
 * @param rows - The table rows (2D array)
 *
 * @example
 * ```typescript
 * table(
 *   ['Name', 'Status', 'Port'],
 *   [
 *     ['Server 1', 'Running', '3000'],
 *     ['Server 2', 'Stopped', '3001'],
 *     ['Server 3', 'Running', '3002']
 *   ]
 * );
 * ```
 */
export function table(headers: string[], rows: string[][]): void {
  const columnWidths = headers.map((header, i) => {
    const maxWidth = Math.max(header.length, ...rows.map((row) => (row[i] || "").toString().length));
    return Math.min(maxWidth, 40);
  });

  // Print headers with consola colors
  const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i] || 0)).join(" │ ");

  console.log(colors.bold(headerRow));
  console.log("─".repeat(headerRow.length));

  // Print rows
  for (const row of rows) {
    const rowStr = row
      .map((cell, i) => {
        const str = (cell || "").toString();
        return str.length > (columnWidths[i] || 0)
          ? str.substring(0, (columnWidths[i] || 0) - 3) + "..."
          : str.padEnd(columnWidths[i] || 0);
      })
      .join(" │ ");
    console.log(rowStr);
  }
}

// Clear console

/**
 * Clears the console screen.
 *
 * @example
 * ```typescript
 * clear();
 * console.log('Fresh start!');
 * ```
 */
export function clear(): void {
  console.clear();
}

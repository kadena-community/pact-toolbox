import chalk from "chalk";
import type { SpinnerOptions, ProgressOptions, TableOptions, TUITheme } from "./types";
import { defaultTheme } from "./theme";

export class Spinner {
  private static readonly spinners = {
    dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    line: ["-", "\\", "|", "/"],
    pipe: ["┤", "┘", "┴", "└", "├", "┌", "┬", "┐"],
    star: ["✶", "✸", "✹", "✺", "✹", "✷"],
  };

  private interval?: NodeJS.Timeout;
  private frame = 0;
  private isSpinning = false;

  constructor(
    private options: SpinnerOptions,
    private theme: TUITheme = defaultTheme
  ) {}

  start(text?: string): void {
    if (this.isSpinning) return;

    this.isSpinning = true;
    this.frame = 0;

    if (text) this.options.text = text;

    const frames = Spinner.spinners[this.options.spinner || "dots"];
    const color = chalk.hex(this.theme.colors[this.options.color || "primary"]);
    const indent = " ".repeat(this.options.indent || 0);

    this.interval = setInterval(() => {
      const spinner = color(frames[this.frame]);
      const message = this.options.text || "";
      process.stdout.write(`\r${indent}${spinner} ${message}`);
      this.frame = (this.frame + 1) % frames.length;
    }, 80);
  }

  stop(finalText?: string): void {
    if (!this.isSpinning) return;

    this.isSpinning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    const indent = " ".repeat(this.options.indent || 0);
    const successSymbol = chalk.hex(this.theme.colors.success)(this.theme.symbols.success);
    const message = finalText || this.options.text || "";
    
    process.stdout.write(`\r${indent}${successSymbol} ${message}\n`);
  }

  fail(errorText?: string): void {
    if (!this.isSpinning) return;

    this.isSpinning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    const indent = " ".repeat(this.options.indent || 0);
    const errorSymbol = chalk.hex(this.theme.colors.error)(this.theme.symbols.error);
    const message = errorText || this.options.text || "";
    
    process.stdout.write(`\r${indent}${errorSymbol} ${message}\n`);
  }

  isActive(): boolean {
    return this.isSpinning;
  }
}

export class Progress {
  private startTime = Date.now();

  constructor(
    private options: ProgressOptions,
    private theme: TUITheme = defaultTheme
  ) {}

  update(current: number, text?: string): void {
    this.options.current = current;
    if (text) this.options.text = text;
    this.render();
  }

  increment(amount = 1, text?: string): void {
    this.options.current = (this.options.current || 0) + amount;
    if (text) this.options.text = text;
    this.render();
  }

  finish(text?: string): void {
    this.options.current = this.options.total;
    if (text) this.options.text = text;
    this.render();
    process.stdout.write("\n");
  }

  private render(): void {
    const current = this.options.current || 0;
    const total = this.options.total;
    const percentage = Math.min(100, (current / total) * 100);
    
    const width = this.options.width || 40;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    const color = chalk.hex(this.theme.colors[this.options.color || "primary"]);
    const bar = color("█".repeat(filled)) + "░".repeat(empty);
    
    let output = `[${bar}]`;
    
    if (this.options.showPercentage !== false) {
      output += ` ${percentage.toFixed(1)}%`;
    }
    
    if (this.options.showEta && current > 0) {
      const elapsed = Date.now() - this.startTime;
      const rate = current / elapsed;
      const remaining = (total - current) / rate;
      const eta = remaining > 0 ? this.formatTime(remaining) : "0s";
      output += ` ETA: ${eta}`;
    }
    
    if (this.options.text) {
      output += ` ${this.options.text}`;
    }
    
    process.stdout.write(`\r${output}`);
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

export class Table {
  constructor(
    private options: TableOptions,
    private theme: TUITheme = defaultTheme
  ) {}

  render(): string {
    const { headers, rows, align = [], maxWidth, border = "single" } = this.options;
    const borderChars = this.theme.borders[border];
    
    // Calculate column widths
    const colWidths = this.calculateColumnWidths(headers, rows, maxWidth);
    
    // Build table
    const lines: string[] = [];
    
    // Top border
    lines.push(this.buildBorderLine(colWidths, borderChars, "top"));
    
    // Headers
    lines.push(this.buildDataLine(headers, colWidths, align, borderChars, true));
    
    // Header separator
    lines.push(this.buildBorderLine(colWidths, borderChars, "middle"));
    
    // Data rows
    for (const row of rows) {
      lines.push(this.buildDataLine(row, colWidths, align, borderChars, false));
    }
    
    // Bottom border
    lines.push(this.buildBorderLine(colWidths, borderChars, "bottom"));
    
    return lines.join("\n");
  }

  private calculateColumnWidths(headers: string[], rows: string[][], maxWidth?: number): number[] {
    const colCount = headers.length;
    const widths = new Array(colCount).fill(0);
    
    // Calculate minimum widths based on content
    for (let i = 0; i < colCount; i++) {
      widths[i] = Math.max(widths[i], headers[i].length);
      for (const row of rows) {
        if (row[i]) {
          widths[i] = Math.max(widths[i], row[i].length);
        }
      }
    }
    
    // Apply max width constraint if specified
    if (maxWidth) {
      const totalWidth = widths.reduce((sum, w) => sum + w, 0) + colCount * 3 + 1;
      if (totalWidth > maxWidth) {
        const avgWidth = Math.floor((maxWidth - colCount * 3 - 1) / colCount);
        return widths.map(w => Math.min(w, avgWidth));
      }
    }
    
    return widths;
  }

  private buildBorderLine(widths: number[], chars: string[], type: "top" | "middle" | "bottom"): string {
    const [tl, tr, bl, br, h, v, ml, mr, mt, mb, cross] = chars;
    
    let left: string, right: string, junction: string;
    
    switch (type) {
      case "top":
        left = tl;
        right = tr;
        junction = mt;
        break;
      case "middle":
        left = ml;
        right = mr;
        junction = cross;
        break;
      case "bottom":
        left = bl;
        right = br;
        junction = mb;
        break;
    }
    
    const segments = widths.map(w => h.repeat(w + 2));
    return chalk.hex(this.theme.colors.muted)(left + segments.join(junction) + right);
  }

  private buildDataLine(
    data: string[],
    widths: number[],
    align: ("left" | "center" | "right")[],
    chars: string[],
    isHeader: boolean
  ): string {
    const [, , , , , v] = chars;
    const border = chalk.hex(this.theme.colors.muted)(v);
    
    const cells = data.map((cell, i) => {
      const width = widths[i];
      const alignment = align[i] || "left";
      const content = this.alignText(cell || "", width, alignment);
      
      return isHeader 
        ? chalk.hex(this.theme.colors.primary).bold(content)
        : content;
    });
    
    return border + " " + cells.join(` ${border} `) + " " + border;
  }

  private alignText(text: string, width: number, align: "left" | "center" | "right"): string {
    const trimmed = text.length > width ? text.substring(0, width - 3) + "..." : text;
    const padding = width - trimmed.length;
    
    switch (align) {
      case "center":
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return " ".repeat(leftPad) + trimmed + " ".repeat(rightPad);
      case "right":
        return " ".repeat(padding) + trimmed;
      default:
        return trimmed + " ".repeat(padding);
    }
  }
}

export class Status {
  constructor(private theme: TUITheme = defaultTheme) {}

  success(text: string): string {
    const symbol = chalk.hex(this.theme.colors.success)(this.theme.symbols.success);
    return `${symbol} ${text}`;
  }

  error(text: string): string {
    const symbol = chalk.hex(this.theme.colors.error)(this.theme.symbols.error);
    return `${symbol} ${text}`;
  }

  warning(text: string): string {
    const symbol = chalk.hex(this.theme.colors.warning)(this.theme.symbols.warning);
    return `${symbol} ${text}`;
  }

  info(text: string): string {
    const symbol = chalk.hex(this.theme.colors.info)(this.theme.symbols.info);
    return `${symbol} ${text}`;
  }

  running(text: string): string {
    const symbol = chalk.hex(this.theme.colors.success)(this.theme.symbols.running);
    return `${symbol} ${text}`;
  }

  stopped(text: string): string {
    const symbol = chalk.hex(this.theme.colors.muted)(this.theme.symbols.stopped);
    return `${symbol} ${text}`;
  }
}

// Factory functions
export function createSpinner(options: SpinnerOptions = {}): Spinner {
  return new Spinner(options);
}

export function createProgress(options: ProgressOptions): Progress {
  return new Progress(options);
}

export function createTable(options: TableOptions): Table {
  return new Table(options);
}

export function createStatus(): Status {
  return new Status();
}
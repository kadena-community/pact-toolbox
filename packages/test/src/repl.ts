import type { PactToolboxConfigObj } from "@pact-toolbox/config";
import { cpus } from "node:os";
import { resolveConfig } from "@pact-toolbox/config";
import {
  execAsync,
  glob,
  watch,
  error as errorUI,
  info as infoUI,
  warn as warnUI,
  join,
  relative,
  readFile,
  existsSync,
} from "@pact-toolbox/node-utils";

// ANSI color codes for enhanced output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
} as const;

interface TestFailure {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  expectedValue?: string;
  receivedValue?: string;
  sourceCode?: string;
  context?: string[];
}

interface TestResult {
  filePath: string;
  relativePath: string;
  status: "passed" | "failed" | "skipped";
  error?: Error;
  failures?: TestFailure[];
  duration: number;
  coverage?: CoverageData;
  traceOutput?: string;
  stdout?: string;
  stderr?: string;
}

interface CoverageData {
  lines: {
    total: number;
    covered: number;
    percentage: number;
  };
  functions: {
    total: number;
    covered: number;
    percentage: number;
  };
  branches?: {
    total: number;
    covered: number;
    percentage: number;
  };
}

interface LcovRecord {
  sourceFile: string;
  lines: Array<{ line: number; hits: number; checksum?: string }>;
  functions: Array<{ name: string; line: number; hits: number }>;
  branches: Array<{ line: number; block: number; branch: number; hits: number }>;
  summary: {
    lines: { found: number; hit: number };
    functions: { found: number; hit: number };
    branches: { found: number; hit: number };
  };
}

interface TestRunSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  coverage?: {
    overall: CoverageData;
    files: Record<string, CoverageData>;
  };
}

interface RunReplTestsOptions {
  watch?: boolean;
  trace?: boolean;
  coverage?: boolean;
  verbose?: boolean;
  bail?: boolean; // Stop on first failure
  maxWorkers?: number;
  include?: string[];
  exclude?: string[];
  silent?: boolean;
  testNamePattern?: string;
  testPathPattern?: string;
}

interface TestRunner {
  run(): Promise<TestRunSummary>;
  watch(): Promise<void>;
  dispose(): Promise<void>;
}

class PactReplTestRunner implements TestRunner {
  private config: Required<PactToolboxConfigObj>;
  private options: RunReplTestsOptions;
  private watcher?: ReturnType<typeof watch>;
  private isRunning = false;
  private runCount = 0;
  private lastResults: TestResult[] = [];
  private failedTests: string[] = [];

  constructor(config: Required<PactToolboxConfigObj>, options: RunReplTestsOptions = {}) {
    this.config = config;
    this.options = {
      maxWorkers: Math.max(1, cpus().length - 1),
      verbose: false,
      bail: false,
      silent: false,
      ...options,
    };
  }

  async run(): Promise<TestRunSummary> {
    const startTime = Date.now();
    this.runCount++;

    if (!this.options.silent) {
      this.logRunHeader();
    }

    try {
      const testFiles = await this.findTestFiles();

      if (testFiles.length === 0) {
        if (!this.options.silent) {
          warnUI("repl-test", "No REPL test files found");
        }
        return this.createEmptySummary();
      }

      if (!this.options.silent) {
        infoUI("repl-test", `Found ${testFiles.length} test file${testFiles.length > 1 ? "s" : ""}`);
      }

      const results = await this.runTests(testFiles);
      const summary = this.createSummary(results, Date.now() - startTime);

      // Store results and track failed tests
      this.lastResults = results;
      this.failedTests = results.filter((result) => result.status === "failed").map((result) => result.relativePath);

      if (!this.options.silent) {
        await this.displayResults(results, summary);
      }

      return summary;
    } catch (error) {
      if (!this.options.silent) {
        errorUI("repl-test", `Test run failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }
  }

  async watch(): Promise<void> {
    if (this.watcher) {
      await this.dispose();
    }

    const contractsDir = join(process.cwd(), this.config.contractsDir);

    infoUI("repl-test", `🔍 Watching for changes in ${contractsDir}`);
    this.displayWatchCommands();

    this.watcher = watch(contractsDir, {
      ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/coverage/**", "**/prelude/**"],
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    // Run tests initially
    await this.run();

    this.watcher.on("change", async (filePath) => {
      if (this.isRunning) return;

      const relativePath = relative(contractsDir, filePath);

      if (filePath.endsWith(".repl") || filePath.endsWith(".pact")) {
        this.logWatchEvent("changed", relativePath);
        await this.runWithDebounce();
      }
    });

    this.watcher.on("add", async (filePath) => {
      if (this.isRunning) return;

      const relativePath = relative(contractsDir, filePath);

      if (filePath.endsWith(".repl")) {
        this.logWatchEvent("added", relativePath);
        await this.runWithDebounce();
      }
    });

    this.watcher.on("unlink", async (filePath) => {
      if (this.isRunning) return;

      const relativePath = relative(contractsDir, filePath);

      if (filePath.endsWith(".repl")) {
        this.logWatchEvent("removed", relativePath);
        await this.runWithDebounce();
      }
    });

    // Setup stdin for interactive commands
    this.setupWatchCommands();

    // Keep the process alive
    return new Promise(() => {});
  }

  private displayWatchCommands(): void {
    console.log(`${colors.dim}Watch Usage${colors.reset}`);
    console.log(`${colors.dim} › Press ${colors.bright}a${colors.reset}${colors.dim} to run all tests${colors.reset}`);
    console.log(
      `${colors.dim} › Press ${colors.bright}f${colors.reset}${colors.dim} to run only failed tests${colors.reset}`,
    );
    console.log(
      `${colors.dim} › Press ${colors.bright}o${colors.reset}${colors.dim} to run tests related to changed files${colors.reset}`,
    );
    console.log(
      `${colors.dim} › Press ${colors.bright}p${colors.reset}${colors.dim} to filter by a filename regex pattern${colors.reset}`,
    );
    console.log(
      `${colors.dim} › Press ${colors.bright}t${colors.reset}${colors.dim} to filter by a test name regex pattern${colors.reset}`,
    );
    console.log(
      `${colors.dim} › Press ${colors.bright}q${colors.reset}${colors.dim} to quit watch mode${colors.reset}`,
    );
    console.log(
      `${colors.dim} › Press ${colors.bright}Enter${colors.reset}${colors.dim} to trigger a test run${colors.reset}`,
    );
    console.log();
  }

  private setupWatchCommands(): void {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      const input = key.toString().toLowerCase().trim();

      switch (input) {
        case "a":
          console.log(`\n${colors.cyan}Running all tests...${colors.reset}`);
          this.runAllTests();
          break;
        case "f":
          console.log(`\n${colors.cyan}Running failed tests...${colors.reset}`);
          this.runFailedTests();
          break;
        case "o":
          console.log(`\n${colors.cyan}Running tests related to changed files...${colors.reset}`);
          this.runChangedTests();
          break;
        case "p":
          this.filterByPattern().catch(console.error);
          break;
        case "t":
          this.filterByTestName().catch(console.error);
          break;
        case "q":
          console.log(`\n${colors.yellow}Quitting watch mode...${colors.reset}`);
          this.dispose().then(() => process.exit(0));
          break;
        case "\r":
        case "\n":
          console.log(`\n${colors.cyan}Re-running tests...${colors.reset}`);
          this.runAllTests();
          break;
        case "h":
          this.displayWatchCommands();
          break;
        case "\u0003": // Ctrl+C
          console.log(`\n${colors.yellow}Quitting watch mode...${colors.reset}`);
          this.dispose().then(() => process.exit(0));
          break;
        default:
          if (input.length === 1 && input !== " ") {
            console.log(`\n${colors.yellow}Unknown command: ${input}${colors.reset}`);
            console.log(`${colors.dim}Press ${colors.bright}h${colors.reset}${colors.dim} for help${colors.reset}`);
          }
          break;
      }
    });
  }

  private async runAllTests(): Promise<void> {
    if (this.isRunning) return;
    // Clear any existing filters
    this.options.testNamePattern = undefined;
    this.options.testPathPattern = undefined;
    await this.run();
  }

  private async runFailedTests(): Promise<void> {
    if (this.isRunning) return;
    if (this.failedTests.length === 0) {
      console.log(`${colors.yellow}No failed tests to re-run${colors.reset}`);
      return;
    }
    // Set pattern to match only failed test files
    this.options.testPathPattern = this.failedTests.join("|");
    console.log(`${colors.cyan}Re-running ${this.failedTests.length} failed test(s)...${colors.reset}`);
    await this.run();
  }

  private async runChangedTests(): Promise<void> {
    if (this.isRunning) return;
    // For now, just run all tests - could be enhanced to track changed files
    console.log(`${colors.dim}Note: Running all tests (changed file tracking not yet implemented)${colors.reset}`);
    await this.run();
  }

  private async filterByPattern(): Promise<void> {
    console.log(`${colors.cyan}Filter by filename pattern:${colors.reset}`);
    const pattern = await this.promptForInput("Pattern (RegExp): ");
    if (pattern.trim()) {
      this.options.testPathPattern = pattern.trim();
      console.log(`${colors.green}Running tests matching pattern: ${pattern}${colors.reset}`);
      await this.run();
    } else {
      console.log(`${colors.yellow}No pattern provided, running all tests${colors.reset}`);
      await this.runAllTests();
    }
  }

  private async filterByTestName(): Promise<void> {
    console.log(`${colors.cyan}Filter by test name pattern:${colors.reset}`);
    const pattern = await this.promptForInput("Test name pattern (RegExp): ");
    if (pattern.trim()) {
      this.options.testNamePattern = pattern.trim();
      console.log(`${colors.green}Running tests with names matching: ${pattern}${colors.reset}`);
      await this.run();
    } else {
      console.log(`${colors.yellow}No pattern provided, running all tests${colors.reset}`);
      await this.runAllTests();
    }
  }

  private async promptForInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(prompt);

      // Temporarily disable raw mode for input
      process.stdin.setRawMode(false);
      process.stdin.resume();

      const handleInput = (data: Buffer) => {
        const input = data.toString().trim();
        process.stdin.removeListener("data", handleInput);
        process.stdin.pause();

        // Re-enable raw mode for watch commands
        process.stdin.setRawMode(true);
        process.stdin.resume();

        resolve(input);
      };

      process.stdin.once("data", handleInput);
    });
  }

  private debounceTimer?: NodeJS.Timeout;

  private async runWithDebounce(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.isRunning = true;
      try {
        await this.run();
      } finally {
        this.isRunning = false;
      }
    }, 200);
  }

  private logWatchEvent(event: "changed" | "added" | "removed", file: string): void {
    const eventColor = event === "added" ? colors.green : event === "removed" ? colors.red : colors.yellow;
    console.log(
      `\n${colors.dim}${new Date().toLocaleTimeString()}${colors.reset} ${eventColor}${event}${colors.reset} ${file}`,
    );
  }

  private logRunHeader(): void {
    if (this.runCount > 1) {
      console.log(`\n${colors.cyan}${"=".repeat(60)}${colors.reset}`);
      console.log(`${colors.cyan}Re-running tests (${this.runCount})${colors.reset}`);
      console.log(`${colors.cyan}${"=".repeat(60)}${colors.reset}\n`);
    }
  }

  async dispose(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    // Restore stdin to normal mode
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }

  private async findTestFiles(): Promise<string[]> {
    const cwd = join(process.cwd(), this.config.contractsDir);
    const aborter = new AbortController();

    try {
      const result = await glob(`**/*.repl`, {
        cwd,
        depth: 20,
        limit: 1_000_000,
        followSymlinks: true,
        ignore: ["**/prelude/**", "prelude/**"],
        signal: aborter.signal,
      });

      let testFiles = result.files;

      // Apply include/exclude filters
      if (this.options.include?.length) {
        testFiles = testFiles.filter((file) => this.options.include!.some((pattern) => file.includes(pattern)));
      }

      if (this.options.exclude?.length) {
        testFiles = testFiles.filter((file) => !this.options.exclude!.some((pattern) => file.includes(pattern)));
      }

      // Apply path pattern filter
      if (this.options.testPathPattern) {
        try {
          const pathRegex = new RegExp(this.options.testPathPattern, "i");
          testFiles = testFiles.filter((file) => pathRegex.test(file));
        } catch {
          console.warn(`Invalid testPathPattern regex: ${this.options.testPathPattern}`);
        }
      }

      // Apply test name pattern filter (this will be checked during test execution)
      // since we need to read file content to filter by test names

      return testFiles;
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        throw error;
      }
      return [];
    }
  }

  private async runTests(testFiles: string[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const runTest = async (file: string): Promise<TestResult> => {
      const testStartTime = Date.now();
      const relativePath = relative(join(process.cwd(), this.config.contractsDir), file);

      try {
        const result = await this.executeTest(file);

        if (this.options.bail && result.status === "failed") {
          throw new Error("Stopping tests due to failure (--bail)");
        }

        return result;
      } catch (error) {
        const duration = Date.now() - testStartTime;
        const result: TestResult = {
          filePath: file,
          relativePath,
          status: "failed",
          error: error as Error,
          duration,
        };

        if (this.options.bail) {
          throw error;
        }

        return result;
      }
    };

    try {
      const concurrency = this.options.maxWorkers!;
      const allResults = await this.runWithConcurrency(testFiles, runTest, concurrency);
      results.push(...allResults);
    } finally {
      // Test execution complete
    }

    return results;
  }

  private async executeTest(file: string): Promise<TestResult> {
    const testStartTime = Date.now();
    const relativePath = relative(join(process.cwd(), this.config.contractsDir), file);

    // Apply test name pattern filter if specified
    if (this.options.testNamePattern) {
      try {
        const fileContent = await readFile(file, "utf-8");
        const testNameRegex = new RegExp(this.options.testNamePattern, "i");

        // Check if file content contains any test names matching the pattern
        // This is a simple check - could be enhanced to parse actual test names
        if (!testNameRegex.test(fileContent)) {
          return {
            filePath: file,
            relativePath,
            status: "skipped",
            duration: Date.now() - testStartTime,
          };
        }
      } catch {
        console.warn(`Invalid testNamePattern regex: ${this.options.testNamePattern}`);
      }
    }

    // Build pact command with options
    const pactArgs = [file];

    if (this.options.trace) {
      pactArgs.unshift("--trace");
    }

    if (this.options.coverage) {
      pactArgs.unshift("--coverage");
    }

    const command = `pact ${pactArgs.join(" ")}`;

    try {
      const { stderr, stdout } = await execAsync(command);
      const duration = Date.now() - testStartTime;

      // Parse output for failures - check both stderr and stdout
      const allOutput = (stderr || "") + "\n" + (stdout || "");
      const failures = this.parseFailures(allOutput, file);

      // Check for coverage data if coverage was enabled
      let coverage: CoverageData | undefined;
      if (this.options.coverage) {
        coverage = await this.getCoverageForFile(file);
      }

      const status = failures.length > 0 ? "failed" : "passed";

      return {
        filePath: file,
        relativePath,
        status,
        failures,
        duration,
        coverage,
        traceOutput: this.options.trace ? stdout : undefined,
        stdout,
        stderr,
      };
    } catch (error) {
      const duration = Date.now() - testStartTime;
      const errorObj = error as Error & { stdout?: string; stderr?: string };

      // Parse failures from error output - check both stderr and stdout and error message
      const allOutput = (errorObj.stderr || "") + "\n" + (errorObj.stdout || "") + "\n" + (errorObj.message || "");
      const failures = this.parseFailures(allOutput, file);

      // Check for coverage data even if test failed
      let coverage: CoverageData | undefined;
      if (this.options.coverage) {
        coverage = await this.getCoverageForFile(file);
      }

      return {
        filePath: file,
        relativePath,
        status: "failed",
        error: errorObj,
        failures,
        duration,
        coverage,
        traceOutput: this.options.trace ? errorObj.stdout : undefined,
        stdout: errorObj.stdout,
        stderr: errorObj.stderr,
      };
    }
  }

  private parseFailures(output: string, filePath: string): TestFailure[] {
    const failures: TestFailure[] = [];

    // Parse Pact failure format: <file>:<line>:<col>-<endLine>:<endCol>:FAILURE: message
    // Match only lines that end with this pattern, using line boundaries
    const failureRegex = /^([^:\n]+):(\d+):(\d+)-(\d+):(\d+):FAILURE:\s*(.+)$/gm;
    let match;

    while ((match = failureRegex.exec(output)) !== null) {
      const [, file, lineStr, colStr, endLineStr, endColStr, message] = match;

      if (!file || !lineStr || !colStr || !endLineStr || !endColStr || !message) {
        continue;
      }

      // Extract expected/received values first
      const expectationMatch = message.match(/expected:\s*(.+?),\s*received:\s*(.+)/i);
      let cleanedMessage = message.trim();

      // Remove the "expected: ..., received: ..." part from the message if found
      if (expectationMatch) {
        cleanedMessage = cleanedMessage.replace(/\s*expected:\s*.+?,\s*received:\s*.+$/i, "").trim();
      }

      const failure: TestFailure = {
        file: file || filePath,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10) - 1,
        endLine: parseInt(endLineStr, 10),
        endColumn: parseInt(endColStr, 10) - 1,
        message: cleanedMessage,
      };

      // Set expected/received values if found
      if (expectationMatch) {
        failure.expectedValue = expectationMatch[1]?.trim();
        failure.receivedValue = expectationMatch[2]?.trim();
      }

      failures.push(failure);
    }

    // Also check for lexical/parsing errors that don't follow the FAILURE format
    // Example: file.repl:18:69: Lexical Error: String literal parsing error: newline in string literal
    const lexicalRegex = /^([^:\n]+):(\d+):(\d+):\s*(Lexical Error|Parse Error|Syntax Error):\s*(.+)$/gm;
    let lexicalMatch;

    while ((lexicalMatch = lexicalRegex.exec(output)) !== null) {
      const [, file, lineStr, colStr, errorType, message] = lexicalMatch;

      if (!file || !lineStr || !colStr || !message) {
        continue;
      }

      const failure: TestFailure = {
        file: file || filePath,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10) - 1,
        endLine: parseInt(lineStr, 10),
        endColumn: parseInt(colStr, 10), // Assume single character for parsing errors
        message: `${errorType}: ${message.trim()}`,
      };

      failures.push(failure);
    }

    // Remove duplicate failures based on file, line, column, and message
    const uniqueFailures = failures.filter((failure, index, arr) => {
      return !arr
        .slice(0, index)
        .some(
          (prev) =>
            prev.file === failure.file &&
            prev.line === failure.line &&
            prev.column === failure.column &&
            prev.message === failure.message,
        );
    });

    return uniqueFailures;
  }

  /**
   * Get coverage data for a specific file by reading lcov.info
   */
  private async getCoverageForFile(testFile: string): Promise<CoverageData | undefined> {
    try {
      const coverageDir = join(process.cwd(), "pact/coverage");
      const lcovFile = join(coverageDir, "lcov.info");

      if (!existsSync(lcovFile)) {
        return undefined;
      }

      const lcovContent = await readFile(lcovFile, "utf-8");
      const records = this.parseLcovFile(lcovContent);

      // Find coverage for the source file corresponding to this test
      const sourceFile =
        testFile
          // .replace(/\.repl$/, ".pact")
          .split("/")
          .at(-1) || "";
      const record = records.find((r) => r.sourceFile.endsWith(sourceFile) || r.sourceFile.includes(sourceFile));

      if (!record) {
        return undefined;
      }

      return {
        lines: {
          total: record.summary.lines.found,
          covered: record.summary.lines.hit,
          percentage:
            record.summary.lines.found > 0
              ? Math.round((record.summary.lines.hit / record.summary.lines.found) * 100)
              : 0,
        },
        functions: {
          total: record.summary.functions.found,
          covered: record.summary.functions.hit,
          percentage:
            record.summary.functions.found > 0
              ? Math.round((record.summary.functions.hit / record.summary.functions.found) * 100)
              : 0,
        },
        branches: {
          total: record.summary.branches.found,
          covered: record.summary.branches.hit,
          percentage:
            record.summary.branches.found > 0
              ? Math.round((record.summary.branches.hit / record.summary.branches.found) * 100)
              : 0,
        },
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Parse LCOV format file content
   */
  private parseLcovFile(content: string): LcovRecord[] {
    const records: LcovRecord[] = [];
    const lines = content.split("\n").filter((line) => line.trim());

    let currentRecord: Partial<LcovRecord> | null = null;

    for (const line of lines) {
      const [key, value] = line.split(":", 2);

      if (!key || value === undefined) continue;

      switch (key) {
        case "SF": // Source file
          if (currentRecord) {
            records.push(currentRecord as LcovRecord);
          }
          currentRecord = {
            sourceFile: value,
            lines: [],
            functions: [],
            branches: [],
            summary: {
              lines: { found: 0, hit: 0 },
              functions: { found: 0, hit: 0 },
              branches: { found: 0, hit: 0 },
            },
          };
          break;

        case "DA": // Line data
          if (currentRecord) {
            const [lineStr, hitsStr] = value.split(",");
            if (lineStr && hitsStr) {
              currentRecord.lines!.push({
                line: parseInt(lineStr, 10),
                hits: parseInt(hitsStr, 10),
              });
            }
          }
          break;

        case "FN": // Function name
          if (currentRecord) {
            const [lineStr, name] = value.split(",");
            if (lineStr && name) {
              const existingFn = currentRecord.functions!.find((f) => f.name === name);
              if (!existingFn) {
                currentRecord.functions!.push({
                  name,
                  line: parseInt(lineStr, 10),
                  hits: 0, // Will be set by FNDA
                });
              }
            }
          }
          break;

        case "FNDA": // Function execution count
          if (currentRecord) {
            const [hitsStr, name] = value.split(",");
            if (hitsStr && name) {
              const fn = currentRecord.functions!.find((f) => f.name === name);
              if (fn) {
                fn.hits = parseInt(hitsStr, 10);
              }
            }
          }
          break;

        case "BA": // Branch data
          if (currentRecord) {
            const [lineStr, blockStr, branchStr, hitsStr] = value.split(",");
            if (lineStr && blockStr && branchStr && hitsStr) {
              currentRecord.branches!.push({
                line: parseInt(lineStr, 10),
                block: parseInt(blockStr, 10),
                branch: parseInt(branchStr, 10),
                hits: parseInt(hitsStr, 10),
              });
            }
          }
          break;

        case "LF": // Lines found
          if (currentRecord) {
            currentRecord.summary!.lines.found = parseInt(value, 10);
          }
          break;

        case "LH": // Lines hit
          if (currentRecord) {
            currentRecord.summary!.lines.hit = parseInt(value, 10);
          }
          break;

        case "FNF": // Functions found
          if (currentRecord) {
            currentRecord.summary!.functions.found = parseInt(value, 10);
          }
          break;

        case "FNH": // Functions hit
          if (currentRecord) {
            currentRecord.summary!.functions.hit = parseInt(value, 10);
          }
          break;

        case "BRF": // Branches found
          if (currentRecord) {
            currentRecord.summary!.branches.found = parseInt(value, 10);
          }
          break;

        case "BRH": // Branches hit
          if (currentRecord) {
            currentRecord.summary!.branches.hit = parseInt(value, 10);
          }
          break;

        case "end_of_record":
          if (currentRecord) {
            records.push(currentRecord as LcovRecord);
            currentRecord = null;
          }
          break;
      }
    }

    // Add the last record if it exists
    if (currentRecord) {
      records.push(currentRecord as LcovRecord);
    }

    return records;
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    iteratorFn: (item: T) => Promise<R>,
    concurrency: number,
  ): Promise<R[]> {
    const results: R[] = [];
    const running: Promise<void>[] = [];
    let index = 0;

    async function run() {
      if (index >= items.length) return;

      const i = index++;
      const item = items[i];
      if (!item) return;

      const promise = iteratorFn(item).then((result) => {
        results[i] = result;
      });

      running.push(promise);

      if (running.length >= concurrency) {
        await Promise.race(running);
      }

      await promise.finally(() => {
        const promiseIndex = running.indexOf(promise);
        if (promiseIndex > -1) {
          running.splice(promiseIndex, 1);
        }
      });

      await run();
    }

    const initialRuns = Array.from({ length: Math.min(concurrency, items.length) }, run);
    await Promise.all(initialRuns);
    await Promise.all(running);

    return results;
  }

  private createSummary(results: TestResult[], totalDuration: number): TestRunSummary {
    const passedTests = results.filter((r) => r.status === "passed");
    const failedTests = results.filter((r) => r.status === "failed");
    const skippedTests = results.filter((r) => r.status === "skipped");

    // Calculate overall coverage if available
    let coverage: TestRunSummary["coverage"];
    if (this.options.coverage) {
      coverage = this.calculateOverallCoverage(results);
    }

    return {
      totalTests: results.length,
      passedTests: passedTests.length,
      failedTests: failedTests.length,
      skippedTests: skippedTests.length,
      totalDuration,
      coverage,
    };
  }

  /**
   * Calculate overall coverage from individual test results
   */
  private calculateOverallCoverage(results: TestResult[]): TestRunSummary["coverage"] {
    const resultsWithCoverage = results.filter((r) => r.coverage);

    if (resultsWithCoverage.length === 0) {
      return undefined;
    }

    // Aggregate coverage data
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    const files: Record<string, CoverageData> = {};

    for (const result of resultsWithCoverage) {
      if (result.coverage) {
        totalLines += result.coverage.lines.total;
        coveredLines += result.coverage.lines.covered;
        totalFunctions += result.coverage.functions.total;
        coveredFunctions += result.coverage.functions.covered;

        if (result.coverage.branches) {
          totalBranches += result.coverage.branches.total;
          coveredBranches += result.coverage.branches.covered;
        }

        files[result.relativePath] = result.coverage;
      }
    }

    const overall: CoverageData = {
      lines: {
        total: totalLines,
        covered: coveredLines,
        percentage: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0,
      },
      functions: {
        total: totalFunctions,
        covered: coveredFunctions,
        percentage: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 0,
      },
    };

    if (totalBranches > 0) {
      overall.branches = {
        total: totalBranches,
        covered: coveredBranches,
        percentage: Math.round((coveredBranches / totalBranches) * 100),
      };
    }

    return { overall, files };
  }

  private createEmptySummary(): TestRunSummary {
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
    };
  }

  private async displayResults(results: TestResult[], summary: TestRunSummary): Promise<void> {
    // Clear screen in watch mode for fresh output like Jest/Vitest
    if (this.options.watch) {
      // Use proper screen clearing sequence
      process.stdout.write("\x1b[2J\x1b[H");
    } else {
      console.log(); // Add spacing for non-watch mode
    }

    // Display test results table
    await this.displayResultsTable(results);

    // Display detailed failures
    await this.displayFailures(results);

    // Add separator line before summary
    console.log(`${colors.dim}${"-".repeat(50)}${colors.reset}`);

    // Display summary
    this.displaySummary(summary);

    // Display coverage if enabled
    if (this.options.coverage) {
      this.displayCoverage(results);
    }

    // Show watch commands at the bottom in watch mode
    if (this.options.watch) {
      this.displayWatchCommands();
    }
  }

  private async displayResultsTable(results: TestResult[]): Promise<void> {
    if (results.length === 0) return;

    // Group results by status for better visual organization
    const passedTests = results.filter((r) => r.status === "passed");
    const failedTests = results.filter((r) => r.status === "failed");
    const skippedTests = results.filter((r) => r.status === "skipped");

    // Display passed tests
    if (passedTests.length > 0) {
      for (const result of passedTests) {
        const durationColor = this.getDurationColor(result.duration);
        console.log(
          `${colors.green}${colors.bright} ✓${colors.reset} ${colors.dim}${result.relativePath}${colors.reset} ${durationColor}(${result.duration}ms)${colors.reset}`,
        );
      }
    }

    // Display failed tests
    if (failedTests.length > 0) {
      for (const result of failedTests) {
        const durationColor = this.getDurationColor(result.duration);
        console.log(
          `${colors.red}${colors.bright} ✖${colors.reset} ${colors.dim}${result.relativePath}${colors.reset} ${durationColor}(${result.duration}ms)${colors.reset}`,
        );
      }
    }

    // Display skipped tests
    if (skippedTests.length > 0) {
      for (const result of skippedTests) {
        const durationColor = this.getDurationColor(result.duration);
        console.log(
          `${colors.yellow} ○${colors.reset} ${colors.dim}${result.relativePath}${colors.reset} ${durationColor}(${result.duration}ms)${colors.reset}`,
        );
      }
    }
  }

  private getDurationColor(duration: number): string {
    if (duration > 1000) return colors.red; // > 1s is slow
    if (duration > 500) return colors.yellow; // > 500ms is moderate
    return colors.green; // Fast
  }

  private async displayFailures(results: TestResult[]): Promise<void> {
    const failedTests = results.filter((r) => r.status === "failed");

    if (failedTests.length === 0) return;

    console.log(`\n${colors.red}${colors.bright}Failed Tests:${colors.reset}\n`);

    for (const test of failedTests) {
      await this.displayTestFailure(test);
    }
  }

  private async displayTestFailure(test: TestResult): Promise<void> {
    console.log(`${colors.red}${colors.bright}● ${test.relativePath}${colors.reset}`);

    if (test.failures && test.failures.length > 0) {
      for (const failure of test.failures) {
        await this.displayFailureDetails(failure);
      }
    } else if (test.error) {
      const errorMessage = test.error.message ?? "Unknown error";
      const cleanedError = errorMessage.includes("Command failed:")
        ? (errorMessage.split("Command failed:")[1]?.trim() ?? "")
        : errorMessage;
      console.log(`  ${colors.red}${cleanedError}${colors.reset}`);
    }

    console.log(); // Add spacing between failures
  }

  private async displayFailureDetails(failure: TestFailure): Promise<void> {
    // Display location (showing the original Pact-reported line number)
    console.log(`  ${colors.dim}at ${failure.file}:${failure.line}:${failure.column + 1}${colors.reset}`);

    // Display message
    console.log(`  ${colors.red}${failure.message}${colors.reset}`);

    // Display expected/received if available
    if (failure.expectedValue && failure.receivedValue) {
      console.log(`    ${colors.green}Expected: ${failure.expectedValue}${colors.reset}`);
      console.log(`    ${colors.red}Received: ${failure.receivedValue}${colors.reset}`);
    }

    // Display source code context only for runtime failures, not parsing errors
    if (!this.isParsingError(failure)) {
      await this.displaySourceContext(failure);
    }
  }

  private isParsingError(failure: TestFailure): boolean {
    // Check if this is a lexical/parsing error that shouldn't show source context
    const parsingErrorPatterns = [
      /lexical error/i,
      /parse error/i,
      /parsing error/i,
      /syntax error/i,
      /unexpected token/i,
      /string literal parsing error/i,
      /newline in string literal/i,
    ];

    return parsingErrorPatterns.some((pattern) => pattern.test(failure.message));
  }

  private async displaySourceContext(failure: TestFailure): Promise<void> {
    try {
      const sourceCode = await readFile(failure.file, "utf-8");
      const lines = sourceCode.split("\n");

      // Show context around the failure
      const contextRadius = 2;
      const startLine = Math.max(0, failure.line - contextRadius);
      const endLine = Math.min(lines.length - 1, failure.line + contextRadius);

      console.log(`\n  ${colors.dim}Source:${colors.reset}`);

      for (let i = startLine; i <= endLine; i++) {
        const lineNum = i + 1; // Display 1-based line numbers for user readability
        const line = lines[i] || "";
        const isFailureLine = i >= failure.line && i <= failure.endLine;

        const lineNumStr = String(lineNum).padStart(4);
        const prefix = isFailureLine ? `${colors.red}${colors.bright}>${colors.reset}` : " ";

        if (isFailureLine) {
          // Highlight the specific part that failed
          const beforeError = line.substring(0, failure.column);
          const errorPart = line.substring(failure.column, failure.endColumn);
          const afterError = line.substring(failure.endColumn);

          console.log(
            `  ${prefix} ${colors.dim}${lineNumStr}${colors.reset} | ${beforeError}${colors.bgRed}${colors.white}${errorPart}${colors.reset}${afterError}`,
          );
        } else {
          console.log(`  ${prefix} ${colors.dim}${lineNumStr}${colors.reset} | ${line}`);
        }
      }

      console.log();
    } catch {
      // If we can't read the source file, just continue
    }
  }

  private displaySummary(summary: TestRunSummary): void {
    const { totalTests, passedTests, failedTests, skippedTests, totalDuration, coverage } = summary;

    console.log(); // Add spacing

    // Test results summary with colors and symbols
    const testResults = [];

    if (failedTests > 0) {
      testResults.push(`${colors.red}${colors.bright}✖ ${failedTests} failed${colors.reset}`);
    }

    if (skippedTests > 0) {
      testResults.push(`${colors.yellow}○ ${skippedTests} skipped${colors.reset}`);
    }

    if (passedTests > 0) {
      testResults.push(`${colors.green}✓ ${passedTests} passed${colors.reset}`);
    }

    // Build the main status line
    const statusLine = testResults.join(", ");
    const totalText = `${colors.dim}${totalTests} total${colors.reset}`;

    // Duration with appropriate color (red if >5s, yellow if >2s, green otherwise)
    const durationSeconds = totalDuration / 1000;
    let durationColor: string = colors.green;
    if (durationSeconds > 5) durationColor = colors.red;
    else if (durationSeconds > 2) durationColor = colors.yellow;

    const timeText = `${durationColor}${durationSeconds.toFixed(2)}s${colors.reset}`;

    // Overall status color and symbol
    const overallStatus =
      failedTests > 0
        ? `${colors.red}${colors.bright}FAIL${colors.reset}`
        : `${colors.green}${colors.bright}PASS${colors.reset}`;

    console.log(`${colors.bright}Test Suites: ${colors.reset}${statusLine}, ${totalText}`);
    console.log(`${colors.bright}Tests:       ${colors.reset}${overallStatus}`);
    console.log(`${colors.bright}Time:        ${colors.reset}${timeText}`);

    // Add coverage summary if available
    if (coverage?.overall) {
      const { lines, functions, branches } = coverage.overall;

      const getCoverageColor = (percentage: number) => {
        if (percentage >= 80) return colors.green;
        if (percentage >= 60) return colors.yellow;
        return colors.red;
      };

      const formatCoverage = (name: string, data: { percentage: number; covered: number; total: number }) => {
        const color = getCoverageColor(data.percentage);
        const percentage = data.percentage.toFixed(1);
        return `${color}${percentage}%${colors.reset} (${data.covered}/${data.total})`;
      };

      console.log(`${colors.bright}Coverage:    ${colors.reset}${formatCoverage("lines", lines)}`);

      if (functions.total > 0) {
        console.log(`${colors.bright}Functions:   ${colors.reset}${formatCoverage("funcs", functions)}`);
      }

      if (branches && branches.total > 0) {
        console.log(`${colors.bright}Branches:    ${colors.reset}${formatCoverage("branch", branches)}`);
      }
    }

    console.log(); // Add spacing after summary
  }

  private displayCoverage(results: TestResult[]): void {
    const summary = this.calculateOverallCoverage(results);

    if (!summary) {
      console.log(`\n${colors.yellow}Coverage enabled but no coverage data found.${colors.reset}`);
      console.log(`${colors.dim}Ensure pact generates coverage/lcov.info when running with --coverage${colors.reset}`);
      return;
    }

    console.log(`\n${colors.cyan}${colors.bright}Coverage Summary:${colors.reset}`);

    const { overall } = summary;

    // Overall coverage
    console.log(`\n${colors.bright}Overall Coverage:${colors.reset}`);
    this.displayCoverageMetric("Lines", overall.lines);
    this.displayCoverageMetric("Functions", overall.functions);
    if (overall.branches && overall.branches.total > 0) {
      this.displayCoverageMetric("Branches", overall.branches);
    }

    // Per-file coverage (if verbose or few files)
    const filesWithCoverage = Object.keys(summary.files);
    if (this.options.verbose && filesWithCoverage.length > 0) {
      console.log(`\n${colors.bright}Per-file Coverage:${colors.reset}`);
      for (const file of filesWithCoverage) {
        const coverage = summary.files[file];
        if (coverage) {
          console.log(`\n${colors.dim}${file}:${colors.reset}`);
          this.displayCoverageMetric("  Lines", coverage.lines);
          this.displayCoverageMetric("  Functions", coverage.functions);
          if (coverage.branches && coverage.branches.total > 0) {
            this.displayCoverageMetric("  Branches", coverage.branches);
          }
        }
      }
    }

    // Coverage file location
    console.log(`\n${colors.dim}Coverage report: coverage/lcov.info${colors.reset}`);
  }

  private displayCoverageMetric(label: string, metric: { total: number; covered: number; percentage: number }): void {
    const percentageColor =
      metric.percentage >= 80 ? colors.green : metric.percentage >= 60 ? colors.yellow : colors.red;

    const bar = this.createCoverageBar(metric.percentage);

    console.log(
      `${label.padEnd(12)} ${percentageColor}${metric.percentage.toString().padStart(3)}%${colors.reset} ` +
        `${bar} ${colors.dim}${metric.covered}/${metric.total}${colors.reset}`,
    );
  }

  private createCoverageBar(percentage: number): string {
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;

    const filledColor = percentage >= 80 ? colors.green : percentage >= 60 ? colors.yellow : colors.red;

    const filledBar = "█".repeat(filled);
    const emptyBar = "░".repeat(empty);

    return `${filledColor}${filledBar}${colors.dim}${emptyBar}${colors.reset}`;
  }
}

// Main exported function
export async function runReplTests(
  config?: Required<PactToolboxConfigObj>,
  options: RunReplTestsOptions = {},
): Promise<TestRunSummary> {
  if (!config) {
    config = await resolveConfig();
  }

  const runner = new PactReplTestRunner(config, options);

  try {
    if (options.watch) {
      await runner.watch();
      // This will never resolve in watch mode
      return {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        totalDuration: 0,
      };
    } else {
      const summary = await runner.run();

      // Exit with error code if tests failed
      if (summary.failedTests > 0) {
        process.exit(1);
      }

      return summary;
    }
  } finally {
    await runner.dispose();
  }
}

// Export types and utilities
export type { RunReplTestsOptions, TestResult, TestFailure, TestRunSummary, CoverageData };

export { PactReplTestRunner };

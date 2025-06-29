import { describe, it, expect } from "vitest";
import * as nodeUtils from "../src/index";

describe("@pact-toolbox/node-utils", () => {
  it("should export all utilities from index", () => {
    // Cleanup utilities
    expect(nodeUtils).toHaveProperty("cleanupOnExit");

    // Filesystem utilities
    expect(nodeUtils).toHaveProperty("ensureDir");
    expect(nodeUtils).toHaveProperty("writeFile");
    expect(nodeUtils).toHaveProperty("readFile");
    expect(nodeUtils).toHaveProperty("exists");
    expect(nodeUtils).toHaveProperty("existsSync");
    expect(nodeUtils).toHaveProperty("getStats");
    expect(nodeUtils).toHaveProperty("copyFile");
    expect(nodeUtils).toHaveProperty("removeFile");
    expect(nodeUtils).toHaveProperty("removeDir");
    expect(nodeUtils).toHaveProperty("calculateFileHash");
    expect(nodeUtils).toHaveProperty("calculateContentHash");
    expect(nodeUtils).toHaveProperty("glob");
    expect(nodeUtils).toHaveProperty("watch");
    expect(nodeUtils).toHaveProperty("matchPattern");

    // Path utilities (from pathe)
    expect(nodeUtils).toHaveProperty("join");
    expect(nodeUtils).toHaveProperty("resolve");
    expect(nodeUtils).toHaveProperty("dirname");
    expect(nodeUtils).toHaveProperty("basename");

    // Helper utilities
    expect(nodeUtils).toHaveProperty("execAsync");

    // Logger utilities
    expect(nodeUtils).toHaveProperty("logger");
    expect(nodeUtils).toHaveProperty("createLogger");
    expect(nodeUtils).toHaveProperty("logPerformance");
    expect(nodeUtils).toHaveProperty("logWithContext");
    expect(nodeUtils).toHaveProperty("info");
    expect(nodeUtils).toHaveProperty("warn");
    expect(nodeUtils).toHaveProperty("error");
    expect(nodeUtils).toHaveProperty("debug");
    expect(nodeUtils).toHaveProperty("success");
    expect(nodeUtils).toHaveProperty("fail");
    expect(nodeUtils).toHaveProperty("ready");
    expect(nodeUtils).toHaveProperty("start");
    expect(nodeUtils).toHaveProperty("colors");

    // Object utilities
    expect(nodeUtils).toHaveProperty("defu");
    expect(nodeUtils).toHaveProperty("defuFn");
    expect(nodeUtils).toHaveProperty("defuArrayFn");
    expect(nodeUtils).toHaveProperty("createDefu");

    // Pact utilities
    expect(nodeUtils).toHaveProperty("isAnyPactInstalled");
    expect(nodeUtils).toHaveProperty("getCurrentPactVersion");
    expect(nodeUtils).toHaveProperty("installPact");
    expect(nodeUtils).toHaveProperty("PACT_VERSION_REGEX");

    // Port utilities
    expect(nodeUtils).toHaveProperty("getRandomNetworkPorts");
    expect(nodeUtils).toHaveProperty("isPortTaken");
    expect(nodeUtils).toHaveProperty("getRandomPort");

    // Process utilities
    expect(nodeUtils).toHaveProperty("runBin");
    expect(nodeUtils).toHaveProperty("killProcess");
    expect(nodeUtils).toHaveProperty("spawnProcess");
    expect(nodeUtils).toHaveProperty("isProcessRunning");
    expect(nodeUtils).toHaveProperty("getProcessInfo");

    // Prompt utilities
    expect(nodeUtils).toHaveProperty("spinner");
    expect(nodeUtils).toHaveProperty("isCancel");
    expect(nodeUtils).toHaveProperty("select");
    expect(nodeUtils).toHaveProperty("text");
    expect(nodeUtils).toHaveProperty("intro");
    expect(nodeUtils).toHaveProperty("outro");
    expect(nodeUtils).toHaveProperty("multiselect");

    // UI utilities
    expect(nodeUtils).toHaveProperty("startSpinner");
    expect(nodeUtils).toHaveProperty("stopSpinner");
    expect(nodeUtils).toHaveProperty("updateSpinner");
    expect(nodeUtils).toHaveProperty("boxMessage");
    expect(nodeUtils).toHaveProperty("table");
    expect(nodeUtils).toHaveProperty("clear");
  });

  it("should have proper type exports", () => {
    // Type checking happens at compile time, but we can check the shape
    const utils: typeof nodeUtils = nodeUtils;

    // Verify it's an object with expected shape
    expect(typeof utils).toBe("object");
    expect(utils).not.toBeNull();
  });
});

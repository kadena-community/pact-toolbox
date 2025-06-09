import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { downloadTemplate } from "giget";
import { join } from "pathe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PactToolboxClient } from "@pact-toolbox/runtime";
import { writeFile } from "@pact-toolbox/utils";

import type { CommonPreludeOptions, PactDependency, PactPrelude } from "./types";
import {
  downloadAllPreludes,
  downloadGitRepo,
  downloadPactDependency,
  downloadPrelude,
  groupByBaseRepo,
  isPreludeDownloaded,
  shouldDownloadPreludes,
} from "./downloadPrelude";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  cp: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("giget", () => ({
  downloadTemplate: vi.fn(),
}));

const downloadTemplateMock = vi.mocked(downloadTemplate);
const existsSyncMock = vi.mocked(existsSync);

vi.mock("@pact-toolbox/utils", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    // @ts-ignore
    ...actual,
    writeFile: vi.fn(),
  };
});

describe("downloadPrelude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe("groupByBaseRepo", () => {
    it("should group dependencies by base repository", () => {
      const specs: PactDependency[] = [
        { uri: "gh:owner/repo1/spec1#main", name: "spec1" },
        { uri: "gh:owner/repo1/spec2#main", name: "spec2" },
        { uri: "gh:owner/repo2/spec3#main", name: "spec3" },
      ];
      const grouped = groupByBaseRepo(specs);
      expect(grouped).toEqual({
        "github:owner/repo1#main": [
          { uri: "gh:owner/repo1/spec1#main", name: "spec1" },
          { uri: "gh:owner/repo1/spec2#main", name: "spec2" },
        ],
        "github:owner/repo2#main": [{ uri: "gh:owner/repo2/spec3#main", name: "spec3" }],
      });
    });
  });

  describe("downloadGitRepo", () => {
    it("should download the repository if destination does not exist", async () => {
      existsSyncMock.mockReturnValue(false);
      const dest = "path/to/dest";
      const uri = "repo-uri";
      await downloadGitRepo(dest, uri);
      expect(downloadTemplateMock).toHaveBeenCalledWith(uri, {
        dir: dest,
        cwd: process.cwd(),
        force: true,
        silent: false,
        preferOffline: false,
      });
    });

    it("should not download the repository if destination exists and force is false", async () => {
      existsSyncMock.mockReturnValue(true);
      const dest = "path/to/dest";
      const uri = "repo-uri";
      await downloadGitRepo(dest, uri);
      expect(downloadTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe("downloadPactDependency", () => {
    it("should download dependency", async () => {
      const dep: PactDependency = {
        uri: "provider:owner/repo#ref",
        name: "dep-name",
        group: "group",
      };
      await downloadPactDependency(dep, "prelude-dir");
      expect(downloadTemplateMock).toHaveBeenCalledWith("provider:owner/repo#ref", {
        dir: join(process.cwd(), ".pact-toolbox/tmp", "group"),
        cwd: process.cwd(),
        force: true,
        silent: false,
        preferOffline: false,
      });
    });

    it("should download and copy single file dependency", async () => {
      const dep: PactDependency = {
        uri: "provider:owner/repo/file.pact#ref",
        name: "dep-name",
        group: "group",
      };
      await downloadPactDependency(dep, "prelude-dir");
      expect(downloadTemplateMock).toHaveBeenCalledWith("provider:owner/repo#ref", {
        dir: join(process.cwd(), ".pact-toolbox/tmp", "group"),
        cwd: process.cwd(),
        force: true,
        silent: false,
        preferOffline: false,
      });

      expect(cp).toHaveBeenCalledWith(
        join(join(process.cwd(), ".pact-toolbox/tmp", "group"), "file.pact"),
        join("prelude-dir", "group", "dep-name"),
        { recursive: true },
      );
    });

    it('should download dependencies as if "require" is found', async () => {
      const dep: PactDependency = {
        uri: "provider:owner/repo#ref",
        name: "dep-name",
        group: "group",
        requires: [
          {
            uri: "provider:owner/repo#ref",
            name: "dep-name2",
            group: "group2",
          },
        ],
      };
      await downloadPactDependency(dep, "prelude-dir");
      expect(downloadTemplateMock).toHaveBeenCalledWith("provider:owner/repo#ref", {
        dir: join(process.cwd(), ".pact-toolbox/tmp", "group"),
        cwd: process.cwd(),
        force: true,
        silent: false,
        preferOffline: false,
      });

      expect(downloadTemplateMock).toHaveBeenCalledWith("provider:owner/repo#ref", {
        dir: join(process.cwd(), ".pact-toolbox/tmp", "group2"),
        cwd: process.cwd(),
        force: true,
        silent: false,
        preferOffline: false,
      });
    });
  });

  describe("downloadPrelude", () => {
    it("should download a prelude and its dependencies", async () => {
      const prelude: PactPrelude = {
        name: "prelude",
        specs: [{ uri: "gh:owner/repo-uri#main", name: "spec-name", group: "group" }],
        repl: vi.fn(),
        deploy: vi.fn(),
        shouldDeploy: vi.fn(),
      };
      const preludesDir = "preludesDir";
      const client = {} as PactToolboxClient;
      const allPreludes: PactPrelude[] = [prelude];
      const downloaded = new Set<string>();
      await downloadPrelude(prelude, preludesDir, client, allPreludes, downloaded);
      expect(downloadTemplateMock).toHaveBeenCalled();
      expect(cp).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(downloaded.has("prelude")).toBe(true);
    });
  });

  describe("downloadPreludes", () => {
    it("should resolve and download all preludes", async () => {
      const config: CommonPreludeOptions = {
        client: new PactToolboxClient(),
        contractsDir: "contractsDir",
        preludes: [
          {
            name: "prelude",
            specs: [
              {
                uri: "gh:owner/repo-uri#main",
                name: "spec-name",
                group: "group",
              },
            ],
            repl: vi.fn(),
            deploy: vi.fn(),
            shouldDeploy: vi.fn(),
          },
        ],
      };
      await downloadAllPreludes(config);
      expect(downloadTemplateMock).toHaveBeenCalledWith("github:owner/repo-uri#main", {
        dir: join(process.cwd(), ".pact-toolbox/tmp", "prelude"),
        cwd: process.cwd(),
        force: true,
        silent: false,
        preferOffline: false,
      });
      expect(rm).toHaveBeenCalledTimes(2);
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe("isPreludeDownloaded", () => {
    it("should check if prelude is downloaded", () => {
      const prelude: PactPrelude = {
        name: "prelude",
        specs: [{ uri: "gh:owner/repo-uri#main", name: "spec-name", group: "group" }],
        repl: vi.fn(),
        deploy: vi.fn(),
        shouldDeploy: vi.fn(),
      };
      const preludesDir = "preludesDir";
      existsSyncMock.mockReturnValue(true);
      const result = isPreludeDownloaded(prelude, preludesDir);
      expect(result).toBe(true);
    });
  });

  describe("shouldDownloadPreludes", () => {
    it("should determine if any preludes need to be downloaded", async () => {
      const config: CommonPreludeOptions = {
        client: new PactToolboxClient(),
        contractsDir: "contractsDir",
        preludes: [
          {
            name: "prelude",
            specs: [
              {
                uri: "gh:owner/repo-uri#main",
                name: "spec-name",
                group: "group",
              },
            ],
            repl: vi.fn(),
            deploy: vi.fn(),
            shouldDeploy: vi.fn(),
          },
        ],
      };
      existsSyncMock.mockReturnValue(false);
      const result = await shouldDownloadPreludes(config);
      expect(result).toBe(true);
    });
  });
});

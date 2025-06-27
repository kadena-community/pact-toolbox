import { describe, it, expect } from "vitest";
import type { PactDependency } from "./types";
import { groupByBaseRepo } from "./downloadPrelude";

describe("Download Prelude Utils", () => {
  describe("groupByBaseRepo", () => {
    it("groups dependencies by repository", () => {
      const testDependency: PactDependency = {
        name: "test.pact",
        uri: "github:org1/repo1/path/file1.pact#main",
        group: "test-group",
      };

      const deps = [
        { ...testDependency, uri: "github:org1/repo1/path/file1.pact#main" },
        { ...testDependency, uri: "github:org1/repo1/path/file2.pact#main" },
        { ...testDependency, uri: "github:org2/repo2/path/file3.pact#main" },
      ];

      const result = groupByBaseRepo(deps);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result["github:org1/repo1#main"]).toBeDefined();
      expect(result["github:org1/repo1#main"]).toHaveLength(2);
      expect(result["github:org2/repo2#main"]).toBeDefined();
      expect(result["github:org2/repo2#main"]).toHaveLength(1);
    });

    it("handles different URI formats", () => {
      const testDependency: PactDependency = {
        name: "test.pact",
        uri: "gh:org/repo/file.pact#main",
        group: "test-group",
      };

      const deps = [
        { ...testDependency, uri: "gh:org/repo/file1.pact#main" },
        { ...testDependency, uri: "gh:org/repo/file2.pact#dev" },
        { ...testDependency, uri: "github:other/repo/file3.pact#main" },
      ];

      const result = groupByBaseRepo(deps);

      expect(Object.keys(result)).toHaveLength(3);
      // gh: gets normalized to github: in the grouping
      expect(result["github:org/repo#main"]).toHaveLength(1);
      expect(result["github:org/repo#dev"]).toHaveLength(1);
      expect(result["github:other/repo#main"]).toHaveLength(1);
    });

    it("handles empty dependency list", () => {
      const result = groupByBaseRepo([]);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });
});
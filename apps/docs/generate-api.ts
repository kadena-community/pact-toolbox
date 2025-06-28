import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packages = [
  "chainweb-client",
  "config",
  "crypto",
  "dev-wallet",
  "kda",
  "network",
  "prelude",
  "runtime",
  "script",
  "signers",
  "test",
  "transaction",
  "unplugin",
  "wallet-adapters",
  "wallet-core",
  "wallet-ui",
];

async function generateApiDocs() {
  console.log("Generating API documentation...");

  // Ensure api directory exists
  const apiDir = path.join(__dirname, "docs", "api");
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  } else {
    fs.rmSync(apiDir, { recursive: true });
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // Generate docs for each package in parallel
  const generatePackageDocs = async (pkg: string) => {
    console.log(`Processing @pact-toolbox/${pkg}...`);

    const packagePath = path.join(__dirname, "..", "..", "packages", pkg);
    const entryPoint = path.join(packagePath, "src", "index.ts");
    const outputDir = path.join(apiDir, pkg);

    // Check if package exists
    if (!fs.existsSync(entryPoint)) {
      console.warn(`  ⚠️  Entry point not found: ${entryPoint}`);
      return { pkg, success: false };
    }

    // Check for package-specific tsconfig
    let tsconfig = path.join(packagePath, "tsconfig.json");
    if (!fs.existsSync(tsconfig)) {
      // Use tooling tsconfig as fallback
      tsconfig = path.join(__dirname, "..", "..", "tooling", "tsconfig", "base.json");
    }

    try {
      await execAsync(
        `npx typedoc --out "${outputDir}" --entryPoints "${entryPoint}" --tsconfig "${tsconfig}" --options ./typedoc.json`,
      );

      console.log(`  ✅ Generated docs for ${pkg}`);
      return { pkg, success: true };
    } catch (error) {
      console.error(`  ❌ Failed to generate docs for ${pkg}`);
      return { pkg, success: false };
    }
  };

  // Process packages in batches to avoid overwhelming the system
  const batchSize = 4; // Adjust based on system capabilities
  const results = [];

  for (let i = 0; i < packages.length; i += batchSize) {
    const batch = packages.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(generatePackageDocs));
    results.push(...batchResults);
  }

  // Generate index file with links to all package docs
  console.log("\nGenerating API index file...");

  const indexContent = `# API Reference

This section contains the API documentation for all pact-toolbox packages.

## Packages

${packages
    .map((pkg) => {
      const pkgPath = path.join(apiDir, pkg);
      if (fs.existsSync(pkgPath)) {
        const coverageBadgePath = path.join(pkgPath, "coverage.svg");
        const hasCoverageBadge = fs.existsSync(coverageBadgePath);
        const badge = hasCoverageBadge ? ` ![Coverage](./${pkg}/coverage.svg)` : "";
        return `- [@pact-toolbox/${pkg}](./${pkg}/README.md)${badge}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n")}

Each package's documentation includes:
- Exported functions and classes
- Type definitions
- Interfaces and enums
- Usage examples where available
`;

  fs.writeFileSync(path.join(apiDir, "index.md"), indexContent);
  console.log("  ✅ Generated API index file");

  console.log("\nAPI documentation generation complete!");
}

// Run the async function
generateApiDocs().catch(console.error);

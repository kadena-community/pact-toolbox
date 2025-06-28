import { fillTemplatePlaceholders } from "@pact-toolbox/utils";
import { logger, writeFile, execAsync, spinner, isCancel, select, text } from "@pact-toolbox/node-utils";
import { defineCommand, runMain } from "citty";
import { readdir, readFile, access } from "node:fs/promises";
import { resolve, dirname, join } from "pathe";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import packageJson from "../package.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Files that should have template placeholders replaced
 */
const TEMPLATE_FILES = ["package.json", "README.md"];

/**
 * Validates a project name according to npm package name rules
 */
export function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: "Project name cannot be empty" };
  }

  if (name.length > 214) {
    return { valid: false, error: "Project name must be less than 214 characters" };
  }

  if (name.toLowerCase() !== name) {
    return { valid: false, error: "Project name must be lowercase" };
  }

  if (/^[._]/.test(name)) {
    return { valid: false, error: "Project name cannot start with . or _" };
  }

  if (!/^[a-z0-9@/_-]+$/.test(name)) {
    return { valid: false, error: "Project name can only contain lowercase letters, numbers, @, /, _, and -" };
  }

  return { valid: true };
}

/**
 * Checks if a directory exists and is accessible
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const main = defineCommand({
  meta: {
    name: "create-pact-toolbox-app",
    description: "Create a new Pact Toolbox app with the selected template",
    version: packageJson.version,
  },
  args: {
    name: {
      type: "string",
      name: "name",
      alias: "n",
      description: "The name of the project to create",
    },
    template: {
      type: "string",
      alias: "t",
      name: "template",
      description: "The template to use for the new project",
    },
    git: {
      type: "boolean",
      alias: "g",
      name: "git",
      defaultValue: true,
      description: "Initialize a git repository",
    },
  },

  run: async ({ args }) => {
    let projectName = args.name;
    let template = args.template;

    // Get project name from user input or arguments
    if (!projectName) {
      const selectedName = await text({
        message: "What would you like to name your project?",
        placeholder: "my-pact-app",
        defaultValue: "my-pact-app",
      });
      if (isCancel(selectedName)) {
        logger.info("Operation cancelled.");
        process.exit(0);
      }
      if (!selectedName) {
        logger.error("You must provide a project name.");
        process.exit(1);
      }
      projectName = selectedName as string;
    }

    // Validate project name
    const validation = validateProjectName(projectName);
    if (!validation.valid) {
      logger.error(`Invalid project name: ${validation.error}`);
      process.exit(1);
    }

    // Get template from user input or arguments
    if (!template) {
      const templatesPath = resolve(__dirname, "..", "templates");

      try {
        const availableTemplates = await readdir(templatesPath);
        if (availableTemplates.length === 0) {
          logger.error("No templates found");
          process.exit(1);
        }

        const selectedTemplate = await select({
          message: "Which template would you like to use?",
          options: availableTemplates.map((t) => ({ value: t, label: t })),
        });

        if (isCancel(selectedTemplate)) {
          logger.info("Operation cancelled.");
          process.exit(0);
        }
        template = selectedTemplate as string;
      } catch (error) {
        logger.error("Failed to read templates directory:", error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }

    const projectPath = resolve(process.env.INIT_CWD || process.cwd(), projectName);
    const templatePath = resolve(__dirname, "..", "templates", template);

    // Check if project directory already exists
    if (await directoryExists(projectPath)) {
      logger.error(`Directory ${projectName} already exists. Please choose a different name.`);
      process.exit(1);
    }

    // Check if template exists
    if (!(await directoryExists(templatePath))) {
      logger.error(`Template "${template}" not found`);
      process.exit(1);
    }

    logger.info(`Creating a new Pact Toolbox app named ${projectName} with template ${template}`);

    try {
      // Copy template files
      const templateFiles = await glob("**/*", {
        cwd: templatePath,
        nodir: true,
        dot: true,
      });

      if (templateFiles.length === 0) {
        logger.error(`Template "${template}" is empty`);
        process.exit(1);
      }

      logger.info(`Copying ${templateFiles.length} files...`);

      for (const file of templateFiles) {
        const sourcePath = join(templatePath, file);
        const destPath = join(projectPath, file);

        try {
          let content = await readFile(sourcePath, "utf-8");

          // Replace template placeholders in specific files
          if (TEMPLATE_FILES.includes(file)) {
            content = fillTemplatePlaceholders(content, { "project-name": projectName });
          }

          await writeFile(destPath, content);
        } catch (fileError) {
          logger.error(`Failed to copy ${file}:`, fileError instanceof Error ? fileError.message : String(fileError));
          process.exit(1);
        }
      }

      // Initialize git repository if requested
      if (args.git) {
        const s = spinner();
        s.start("Initializing git repository");
        try {
          // Check if git is available
          await execAsync("git --version", { cwd: projectPath });

          // Initialize git repository
          await execAsync("git init", { cwd: projectPath });

          // Add all files
          await execAsync("git add .", { cwd: projectPath });

          // Create initial commit
          await execAsync('git commit -m "Initial commit from create-pact-toolbox-app"', { cwd: projectPath });

          s.stop("Git repository initialized");
        } catch (gitError) {
          s.stop("Git initialization failed");
          logger.warn(
            "Failed to initialize git repository:",
            gitError instanceof Error ? gitError.message : String(gitError),
          );
          logger.info("You can initialize git manually later with:");
          logger.info("  git init");
          logger.info("  git add .");
          logger.info('  git commit -m "Initial commit"');
        }
      }

      // Success message with next steps
      logger.success(`Successfully created ${projectName} at ${projectPath}`);
      logger.info("");
      logger.info("To get started, run the following commands:");
      logger.info(`  cd ${projectName}`);
      logger.info("  pnpm install");
      logger.info("  pnpm dev");
      logger.info("");
      logger.info("Additional commands:");
      logger.info("  pnpm pact:start    # Start local Pact development network");
      logger.info("  pnpm test          # Run tests");
      logger.info("  pnpm build         # Build for production");
    } catch (err) {
      logger.error("Failed to create the project:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

runMain(main);

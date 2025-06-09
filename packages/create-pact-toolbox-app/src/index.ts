import * as p from "@clack/prompts";
import { logger, writeFile, fillTemplatePlaceholders } from "@pact-toolbox/utils";
import { defineCommand, runMain } from "citty";
import { glob } from "glob";
import { readdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const main = defineCommand({
  meta: {
    name: "create-pact-toolbox-app",
    description: "Create a new Pact Toolbox app",
    version: "0.0.1",
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
  },

  run: async ({ args }) => {
    let projectName = args.name;
    let template = args.template;

    if (!projectName) {
      const selectedName = await p.text({
        message: "What would you like to name your project?",
        placeholder: "my-pact-app",
        defaultValue: "my-pact-app",
      });
      if (p.isCancel(selectedName)) {
        logger.info("Operation cancelled.");
        process.exit(0);
      }
      if (!selectedName) {
        logger.info("You must provide a project name.");
        process.exit(0);
      }
      projectName = selectedName as string;
    }

    if (!template) {
      const templatesPath = path.resolve(__dirname, "..", "templates");
      const availableTemplates = await readdir(templatesPath);
      const selectedTemplate = await p.select({
        message: "Which template would you like to use?",
        options: availableTemplates.map((t) => ({ value: t, label: t })),
      });

      if (p.isCancel(selectedTemplate)) {
        logger.info("Operation cancelled.");
        process.exit(0);
      }
      template = selectedTemplate as string;
    }

    logger.info(`Creating a new Pact Toolbox app named ${projectName} with template ${template}`);
    const projectPath = path.resolve(process.env.INIT_CWD || process.cwd(), projectName);
    const templatePath = path.resolve(__dirname, "..", "templates", template);

    try {
      const templateFiles = await glob(`**/*`, {
        cwd: templatePath,
        nodir: true,
        dot: true,
      });

      for (const file of templateFiles) {
        const sourcePath = path.join(templatePath, file);
        const destPath = path.join(projectPath, file);

        let content = await readFile(sourcePath, "utf-8");

        if (file === "package.json" || file === "README.md") {
          content = fillTemplatePlaceholders(content, { "project-name": projectName });
        }

        await writeFile(destPath, content);
      }

      logger.success(`Successfully created ${projectName} at ${projectPath}`);
      logger.info("To get started, run the following commands:");
      logger.info(`  cd ${projectName}`);
      logger.info("  pnpm install");
      logger.info("  pnpm dev");
    } catch (err) {
      logger.error("Error creating the project:", err);
    }
  },
});

runMain(main);

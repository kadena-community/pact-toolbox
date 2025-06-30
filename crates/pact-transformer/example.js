const { createPactTransformer } = require("./index.js");

// Example usage of the clean, simplified API
async function example() {
  // Create a transformer instance with configuration
  const transformer = createPactTransformer({
    plugins: [{ name: "typescript-generator", enabled: true, options: {} }],
    transform: {
      generateTypes: true,
      sourceMaps: true,
    },
    fileOutput: {
      outputDir: "./output",
      format: "js-types",
      createDir: true,
    },
    watch: {
      patterns: ["**/*.pact"],
      debounceMs: 300,
      initialTransform: true,
    },
  });

  try {
    // Transform code string
    const pactCode = `
      (module hello GOV
        (defcap GOV () true)
        (defun greet:string (name:string)
          (format "Hello, {}!" [name]))
      )
    `;

    const result = await transformer.transform(pactCode, {
      moduleName: "hello-world",
    });

    console.log("JavaScript output:", result.javascript);
    console.log("TypeScript output:", result.typescript);

    // Parse Pact code to get module information
    const modules = transformer.parse(pactCode);
    console.log(
      "Parsed modules:",
      modules.map((m) => m.name),
    );

    // Check for parsing errors
    const errors = transformer.getErrors(pactCode);
    if (errors.length > 0) {
      console.log("Parsing errors:", errors);
    }

    // Example of transforming files (would work if files existed)
    // const fileResult = await transformer.transformFile('./example.pact', {
    //   transformOptions: {
    //     generateTypes: true
    //   }
    // });

    // const batchResult = await transformer.transformFiles(['./contracts/*.pact'], {
    //   transformOptions: {
    //     generateTypes: true
    //   }
    // });
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

module.exports = { example };

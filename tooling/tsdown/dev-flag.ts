import jscodeshift from "jscodeshift";

interface Plugin {
  name: string;
  transform?(code: string, id: string): Promise<{ code: string; map?: any } | null> | { code: string; map?: any } | null;
}

function replaceDev(source: string): string {
  if (/__DEV__/.test(source) !== true) {
    return source;
  }
  const j = jscodeshift.withParser("tsx");
  const root = j(source);
  root
    .find(j.Identifier, { name: "__DEV__" })
    .replaceWith(() =>
      j.binaryExpression(
        "!==",
        j.memberExpression(j.memberExpression(j.identifier("process"), j.identifier("env")), j.identifier("NODE_ENV")),
        j.stringLiteral("production"),
      ),
    );
  return root.toSource();
}

export const DevFlagPlugin: Plugin = {
  name: "dev-flag-plugin",
  async transform(code: string, id: string) {
    // Only process TypeScript and JavaScript files
    if (!/\.(t|j)sx?$/.test(id)) {
      return null;
    }

    // Only process if __DEV__ is present in the code
    if (!/__DEV__/.test(code)) {
      return null;
    }

    const transformedCode = replaceDev(code);
    return {
      code: transformedCode,
      map: null, // You could add source map support here if needed
    };
  },
};

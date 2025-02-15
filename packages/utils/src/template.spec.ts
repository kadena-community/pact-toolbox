import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fillTemplatePlaceholders } from "./template";

describe("fillTemplatePlaceholders", () => {
  it("should replace a single placeholder", () => {
    const template = "Hello, {{name}}!";
    const context = { name: "World" };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Hello, World!");
  });

  it("should replace multiple placeholders", () => {
    const template = "Hello, {{firstName}} {{lastName}}!";
    const context = { firstName: "John", lastName: "Doe" };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Hello, John Doe!");
  });

  it("should handle placeholders with extra whitespace", () => {
    const template = "Hello, {{   name   }}!";
    const context = { name: "Alice" };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Hello, Alice!");
  });

  it("should throw an error if a placeholder is missing in context", () => {
    const template = "Hello, {{name}}!";
    const context = {};
    assert.throws(() => fillTemplatePlaceholders(template, context), /Missing required context values for keys: name/);
  });

  it("should handle multiple missing keys", () => {
    const template = "{{greeting}}, {{name}}!";
    const context = {};
    assert.throws(
      () => fillTemplatePlaceholders(template, context),
      /Missing required context values for keys: greeting, name/,
    );
  });

  it("should handle empty template", () => {
    const template = "";
    const context = { anyKey: "anyValue" };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "");
  });

  it("should handle context values that are not strings", () => {
    const template = "You have {{count}} new messages.";
    const context = { count: 5 };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "You have 5 new messages.");
  });

  it("should handle context values that are undefined", () => {
    const template = "Hello, {{name}}!";
    const context = { name: undefined };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Hello, undefined!");
  });

  it("should handle context values that are null", () => {
    const template = "Hello, {{name}}!";
    const context = { name: null };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Hello, null!");
  });

  it("should not throw an error if context value is falsy but present (e.g., 0, empty string)", () => {
    const template = "Value: {{value}}.";
    const context = { value: 0 };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Value: 0.");
  });

  it("should handle context keys that are objects or arrays", () => {
    const template = "Data: {{data}}.";
    const context = { data: { key: "value" } };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Data: [object Object].");
  });

  it("should not replace placeholders recursively", () => {
    const template = "Value: {{value}}.";
    const context = { value: "{{nested}}", nested: "Actual Value" };
    const result = fillTemplatePlaceholders(template, context);
    assert.strictEqual(result, "Value: {{nested}}.");
  });
});

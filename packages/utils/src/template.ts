/**
 * Replaces placeholders in the given template string with corresponding values from the context.
 *
 * Placeholders are in the format `{{key}}`, where `key` corresponds to a property in the context object.
 * Whitespace around the key inside the curly braces is trimmed.
 *
 * @param template - The template string containing placeholders.
 * @param context - An object containing values to replace placeholders in the template.
 * @returns The template string with placeholders replaced by corresponding context values.
 * @throws {Error} If any placeholders remain after replacement due to missing context values.
 */
export function fillTemplatePlaceholders(template: string, context: Record<string, any>): string {
  const missingKeys = new Set<string>();

  const result = template.replace(/{{\s*(.*?)\s*}}/g, (_, key: string) => {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      return context[key];
    } else {
      missingKeys.add(key);
      return `{{${key}}}`; // Keep the placeholder in the result
    }
  });

  if (missingKeys.size > 0) {
    throw new Error(`Missing required context values for keys: ${Array.from(missingKeys).join(", ")}`);
  }

  return result;
}

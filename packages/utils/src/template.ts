export function fillTemplatePlaceholders(template: string, context: Record<string, any>) {
  const code = template.replace(/{{(.*?)}}/g, (_, key) => context[key]);
  if (code.match(/{{.*}}/)) {
    throw new Error("Missing required context values");
  }
  return code;
}

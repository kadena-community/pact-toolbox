import type { spinner } from "@clack/prompts";

/**
 * Type for spinner instances created by @clack/prompts.
 */
export type Spinner = ReturnType<typeof spinner>;

/**
 * Re-exports from @clack/prompts for interactive CLI prompts.
 *
 * @example
 * ```typescript
 * import { select, text, multiselect, intro, outro } from '@pact-toolbox/node-utils';
 *
 * intro('Welcome to the setup wizard!');
 *
 * const name = await text({
 *   message: 'What is your project name?',
 *   defaultValue: 'my-project'
 * });
 *
 * const framework = await select({
 *   message: 'Pick a framework',
 *   options: [
 *     { value: 'react', label: 'React' },
 *     { value: 'vue', label: 'Vue' },
 *     { value: 'svelte', label: 'Svelte' }
 *   ]
 * });
 *
 * const features = await multiselect({
 *   message: 'Select features',
 *   options: [
 *     { value: 'typescript', label: 'TypeScript' },
 *     { value: 'eslint', label: 'ESLint' },
 *     { value: 'testing', label: 'Testing' }
 *   ]
 * });
 *
 * outro('Setup complete!');
 * ```
 */
export { spinner, isCancel, select, text, intro, outro, multiselect, confirm } from "@clack/prompts";

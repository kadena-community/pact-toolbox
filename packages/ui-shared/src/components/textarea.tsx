import { Component, JSX, Show, splitProps, createMemo, createSignal, createEffect, onMount } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type TextareaSize = "sm" | "md" | "lg";
export type TextareaVariant = "default" | "filled" | "ghost";

interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: TextareaSize;
  variant?: TextareaVariant;
  error?: string | boolean;
  helperText?: string;
  label?: string;
  fullWidth?: boolean;
  autoResize?: boolean;
  maxLength?: number;
  showCharCount?: boolean;
  minRows?: number;
  maxRows?: number;
}

const textareaWrapperStyles = css`
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const textareaWrapperFullWidth = css`
  display: flex;
  width: 100%;
`;

const textareaWrapperInline = css`
  display: inline-flex;
  width: auto;
`;

const labelStyles = css`
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-secondary);
  letter-spacing: var(--pact-letter-spacing-wide);
  margin-bottom: var(--pact-spacing-1);
`;

const textareaContainerStyles = css`
  position: relative;
  display: flex;
  flex-direction: column;
`;

const textareaContainerError = css`
  & textarea {
    border-color: var(--pact-color-error);
    background-color: var(--pact-color-error-lighter);

    &:focus {
      border-color: var(--pact-color-error);
      box-shadow: var(--pact-focus-ring-error);
    }
  }
`;

const textareaBaseStyles = css`
  width: 100%;
  font-family: inherit;
  font-weight: var(--pact-font-weight-normal);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  outline: none;
  resize: vertical;
  line-height: 1.5;
  box-shadow: var(--pact-input-shadow);

  &:disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    background-color: var(--pact-color-bg-tertiary);
    color: var(--pact-color-text-muted);
    resize: none;
  }

  &::placeholder {
    color: var(--pact-color-text-muted);
    opacity: 0.7;
  }
`;

const textareaAutoResize = css`
  resize: none;
  overflow: hidden;
`;

const textareaSizeSmall = css`
  padding: var(--pact-spacing-2) var(--pact-spacing-3);
  font-size: var(--pact-font-size-sm);
  min-height: 64px;
`;

const textareaSizeMedium = css`
  padding: var(--pact-spacing-2_5) var(--pact-spacing-3);
  font-size: var(--pact-font-size-base);
  min-height: 80px;
`;

const textareaSizeLarge = css`
  padding: var(--pact-spacing-3) var(--pact-spacing-4);
  font-size: var(--pact-font-size-lg);
  min-height: 96px;
`;

const textareaVariantDefault = css`
  background-color: var(--pact-color-bg-elevated);
  color: var(--pact-color-text-primary);

  &:hover:not(:disabled) {
    border-color: var(--pact-color-border-hover);
    background-color: var(--pact-color-bg-primary);
  }

  &:focus {
    border-color: var(--pact-focus-color);
    background-color: var(--pact-color-bg-primary);
    box-shadow: var(--pact-focus-ring);
  }
`;

const textareaVariantFilled = css`
  background-color: var(--pact-color-bg-tertiary);
  color: var(--pact-color-text-primary);
  border-color: transparent;
  box-shadow: none;

  &:hover:not(:disabled) {
    background-color: var(--pact-color-bg-secondary);
    border-color: var(--pact-color-border-primary);
  }

  &:focus {
    background-color: var(--pact-color-bg-elevated);
    border-color: var(--pact-focus-color);
    box-shadow: var(--pact-focus-ring);
  }
`;

const textareaVariantGhost = css`
  background-color: transparent;
  color: var(--pact-color-text-primary);
  border-color: transparent;
  border-bottom: 2px solid var(--pact-color-border-primary);
  border-radius: 0;
  box-shadow: none;
  padding-left: 0;
  padding-right: 0;

  &:hover:not(:disabled) {
    border-bottom-color: var(--pact-color-border-hover);
    background-color: var(--pact-color-bg-secondary);
  }

  &:focus {
    border-bottom-color: var(--pact-focus-color);
    background-color: var(--pact-color-bg-secondary);
    box-shadow: none;
  }
`;

const footerStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--pact-spacing-2);
`;

const helperTextStyles = css`
  font-size: var(--pact-font-size-sm);
`;

const helperTextNormal = css`
  color: var(--pact-color-text-secondary);
`;

const helperTextError = css`
  color: var(--pact-color-error);
`;

const charCountStyles = css`
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-tertiary);
  white-space: nowrap;
`;

const charCountOverLimit = css`
  color: var(--pact-color-error);
`;

export const PactTextarea: Component<TextareaProps> = (props) => {
  const [local, textareaProps] = splitProps(props, [
    'size',
    'variant',
    'error',
    'helperText',
    'label',
    'fullWidth',
    'autoResize',
    'maxLength',
    'showCharCount',
    'minRows',
    'maxRows',
    'value',
    'onInput'
  ]);

  const size = () => local.size || 'md';
  const variant = () => local.variant || 'default';
  const fullWidth = () => local.fullWidth ?? false;
  const autoResize = () => local.autoResize ?? false;
  const showCharCount = () => local.showCharCount ?? false;
  const hasError = () => !!local.error;
  const errorMessage = () => typeof local.error === 'string' ? local.error : local.helperText;

  const [charCount, setCharCount] = createSignal(0);
  const [textareaRef, setTextareaRef] = createSignal<HTMLTextAreaElement>();

  const isOverLimit = createMemo(() =>
    local.maxLength ? charCount() > local.maxLength : false
  );

  const adjustHeight = () => {
    const textarea = textareaRef();
    if (!textarea || !autoResize()) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;

    // Calculate line height
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight) || 20;

    let newHeight = scrollHeight;

    if (local.minRows) {
      const minHeight = lineHeight * local.minRows +
        parseInt(computedStyle.paddingTop) +
        parseInt(computedStyle.paddingBottom);
      newHeight = Math.max(newHeight, minHeight);
    }

    if (local.maxRows) {
      const maxHeight = lineHeight * local.maxRows +
        parseInt(computedStyle.paddingTop) +
        parseInt(computedStyle.paddingBottom);
      newHeight = Math.min(newHeight, maxHeight);
    }

    textarea.style.height = `${newHeight}px`;
  };

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLTextAreaElement;
    setCharCount(target.value.length);
    adjustHeight();

    if (typeof local.onInput === 'function') {
      local.onInput(e as any);
    }
  };

  createEffect(() => {
    if (typeof local.value === 'string') {
      setCharCount(local.value.length);
    }
  });

  onMount(() => {
    const textarea = textareaRef();
    if (textarea && typeof local.value === 'string') {
      setCharCount(local.value.length);
      adjustHeight();
    }
  });

  const wrapperClasses = createMemo(() => clsx(
    textareaWrapperStyles,
    fullWidth() ? textareaWrapperFullWidth : textareaWrapperInline
  ));

  const containerClasses = createMemo(() => clsx(
    textareaContainerStyles,
    hasError() && textareaContainerError
  ));

  const textareaClasses = createMemo(() => clsx(
    textareaBaseStyles,
    autoResize() && textareaAutoResize,
    size() === 'sm' && textareaSizeSmall,
    size() === 'md' && textareaSizeMedium,
    size() === 'lg' && textareaSizeLarge,
    variant() === 'default' && textareaVariantDefault,
    variant() === 'filled' && textareaVariantFilled,
    variant() === 'ghost' && textareaVariantGhost,
    textareaProps.class
  ));

  const helperClasses = createMemo(() => clsx(
    helperTextStyles,
    hasError() ? helperTextError : helperTextNormal
  ));

  const charCountClasses = createMemo(() => clsx(
    charCountStyles,
    isOverLimit() && charCountOverLimit
  ));

  const showFooter = createMemo(() =>
    errorMessage() || (showCharCount() && local.maxLength)
  );

  return (
    <div class={wrapperClasses()}>
      <Show when={local.label}>
        <label class={labelStyles}>{local.label}</label>
      </Show>
      <div class={containerClasses()}>
        <textarea
          {...textareaProps}
          ref={setTextareaRef}
          class={textareaClasses()}
          aria-invalid={hasError() ? "true" : "false"}
          aria-describedby={errorMessage() ? "textarea-error" : undefined}
          onInput={handleInput}
        />
      </div>
      <Show when={showFooter()}>
        <div class={footerStyles}>
          <Show when={errorMessage()}>
            <span id="textarea-error" class={helperClasses()}>
              {errorMessage()}
            </span>
          </Show>
          <Show when={showCharCount() && local.maxLength}>
            <span class={charCountClasses()}>
              {charCount()}/{local.maxLength}
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
};
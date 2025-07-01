import { Component, JSX, Show, splitProps, createMemo } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "filled" | "ghost";

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  size?: InputSize;
  variant?: InputVariant;
  error?: string | boolean;
  helperText?: string;
  label?: string;
  fullWidth?: boolean;
  startIcon?: JSX.Element;
  endIcon?: JSX.Element;
}

const inputWrapperStyles = css`
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const inputWrapperFullWidth = css`
  display: flex;
  width: 100%;
`;

const inputWrapperInline = css`
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

const inputContainerStyles = css`
  position: relative;
  display: flex;
  align-items: center;
`;

const inputContainerError = css`
  & input {
    border-color: var(--pact-color-error);
    background-color: var(--pact-color-error-lighter);

    &:focus {
      border-color: var(--pact-color-error);
      box-shadow: var(--pact-focus-ring-error);
    }
  }
`;

const inputBaseStyles = css`
  width: 100%;
  font-family: inherit;
  font-weight: var(--pact-font-weight-normal);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  outline: none;
  box-shadow: var(--pact-input-shadow);

  &:disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    background-color: var(--pact-color-bg-tertiary);
    color: var(--pact-color-text-muted);
  }

  &::placeholder {
    color: var(--pact-color-text-muted);
    opacity: 0.7;
  }
`;

const inputSizeSmall = css`
  padding: var(--pact-spacing-1_5) var(--pact-spacing-3);
  font-size: var(--pact-font-size-sm);
  min-height: 32px;
`;

const inputSizeMedium = css`
  padding: var(--pact-spacing-2) var(--pact-spacing-3);
  font-size: var(--pact-font-size-base);
  min-height: 40px;
`;

const inputSizeLarge = css`
  padding: var(--pact-spacing-2_5) var(--pact-spacing-4);
  font-size: var(--pact-font-size-lg);
  min-height: 48px;
`;

const inputSizeSmallStartIcon = css`
  padding-left: var(--pact-spacing-8);
`;

const inputSizeMediumStartIcon = css`
  padding-left: var(--pact-spacing-10);
`;

const inputSizeLargeStartIcon = css`
  padding-left: var(--pact-spacing-12);
`;

const inputSizeSmallEndIcon = css`
  padding-right: var(--pact-spacing-8);
`;

const inputSizeMediumEndIcon = css`
  padding-right: var(--pact-spacing-10);
`;

const inputSizeLargeEndIcon = css`
  padding-right: var(--pact-spacing-12);
`;

const inputVariantDefault = css`
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

const inputVariantFilled = css`
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

const inputVariantGhost = css`
  background-color: transparent;
  color: var(--pact-color-text-primary);
  border: none;
  border-bottom: 2px solid var(--pact-color-border-primary);
  border-radius: 0;
  box-shadow: none;
  padding-left: 0;
  padding-right: 0;

  &:hover:not(:disabled) {
    border-bottom-color: var(--pact-color-border-hover);
  }

  &:focus {
    border-bottom-color: var(--pact-focus-color);
    box-shadow: 0 1px 0 0 var(--pact-focus-color);
  }

  &:disabled {
    border-bottom-color: var(--pact-color-border-tertiary);
  }
`;

const iconContainerStyles = css`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pact-color-text-secondary);
  pointer-events: none;
`;

const iconContainerStartSmall = css`
  left: var(--pact-spacing-2);
`;

const iconContainerStartMedium = css`
  left: var(--pact-spacing-3);
`;

const iconContainerStartLarge = css`
  left: var(--pact-spacing-4);
`;

const iconContainerEndSmall = css`
  right: var(--pact-spacing-2);
`;

const iconContainerEndMedium = css`
  right: var(--pact-spacing-3);
`;

const iconContainerEndLarge = css`
  right: var(--pact-spacing-4);
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

export const PactInput: Component<InputProps> = (props) => {
  const [local, inputProps] = splitProps(props, [
    'size',
    'variant',
    'error',
    'helperText',
    'label',
    'fullWidth',
    'startIcon',
    'endIcon'
  ]);

  const size = () => local.size || 'md';
  const variant = () => local.variant || 'default';
  const fullWidth = () => local.fullWidth ?? false;
  const hasError = () => !!local.error;
  const errorMessage = () => typeof local.error === 'string' ? local.error : local.helperText;

  const wrapperClasses = createMemo(() => clsx(
    inputWrapperStyles,
    fullWidth() ? inputWrapperFullWidth : inputWrapperInline
  ));

  const containerClasses = createMemo(() => clsx(
    inputContainerStyles,
    hasError() && inputContainerError
  ));

  const inputClasses = createMemo(() => clsx(
    inputBaseStyles,
    size() === 'sm' && inputSizeSmall,
    size() === 'md' && inputSizeMedium,
    size() === 'lg' && inputSizeLarge,
    local.startIcon && size() === 'sm' && inputSizeSmallStartIcon,
    local.startIcon && size() === 'md' && inputSizeMediumStartIcon,
    local.startIcon && size() === 'lg' && inputSizeLargeStartIcon,
    local.endIcon && size() === 'sm' && inputSizeSmallEndIcon,
    local.endIcon && size() === 'md' && inputSizeMediumEndIcon,
    local.endIcon && size() === 'lg' && inputSizeLargeEndIcon,
    variant() === 'default' && inputVariantDefault,
    variant() === 'filled' && inputVariantFilled,
    variant() === 'ghost' && inputVariantGhost,
    inputProps.class
  ));

  const startIconClasses = createMemo(() => clsx(
    iconContainerStyles,
    size() === 'sm' && iconContainerStartSmall,
    size() === 'md' && iconContainerStartMedium,
    size() === 'lg' && iconContainerStartLarge
  ));

  const endIconClasses = createMemo(() => clsx(
    iconContainerStyles,
    size() === 'sm' && iconContainerEndSmall,
    size() === 'md' && iconContainerEndMedium,
    size() === 'lg' && iconContainerEndLarge
  ));

  const helperClasses = createMemo(() => clsx(
    helperTextStyles,
    hasError() ? helperTextError : helperTextNormal
  ));

  return (
    <div class={wrapperClasses()}>
      <Show when={local.label}>
        <label class={labelStyles}>{local.label}</label>
      </Show>
      <div class={containerClasses()}>
        <Show when={local.startIcon}>
          <span class={startIconClasses()}>
            {local.startIcon}
          </span>
        </Show>
        <input
          {...inputProps}
          class={inputClasses()}
          aria-invalid={hasError() ? "true" : "false"}
          aria-describedby={errorMessage() ? "input-error" : undefined}
        />
        <Show when={local.endIcon}>
          <span class={endIconClasses()}>
            {local.endIcon}
          </span>
        </Show>
      </div>
      <Show when={errorMessage()}>
        <span id="input-error" class={helperClasses()}>
          {errorMessage()}
        </span>
      </Show>
    </div>
  );
};
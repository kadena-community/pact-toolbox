import { Component, JSX, For, Show, createSignal, createMemo, splitProps, createEffect } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type SelectVariant = 'default' | 'filled' | 'ghost';
export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  variant?: SelectVariant;
  size?: SelectSize;
  options: SelectOption[];
  placeholder?: string;
  error?: boolean | string;
  helperText?: string;
  label?: string;
  fullWidth?: boolean;
  startIcon?: JSX.Element;
}

// Wrapper styles
const wrapperStyles = css`
  display: inline-flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const fullWidthStyle = css`
  width: 100%;
`;

// Label styles
const labelStyles = css`
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-secondary);
  letter-spacing: var(--pact-letter-spacing-wide);
  margin-bottom: var(--pact-spacing-1);
`;

// Container for select and icon
const containerStyles = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
`;

// Base select styles
const selectBase = css`
  font-family: inherit;
  font-weight: var(--pact-font-weight-normal);
  width: 100%;
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  appearance: none;
  cursor: pointer;
  outline: none;
  box-shadow: var(--pact-input-shadow);

  &:disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    background-color: var(--pact-color-bg-tertiary);
    color: var(--pact-color-text-muted);
  }

  /* Custom arrow with theme-aware color */
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right var(--pact-spacing-3) center;
  background-size: 18px;
  padding-right: var(--pact-spacing-10);
`;

// Size variants
const sizes = {
  sm: css`
    padding: var(--pact-spacing-1_5) var(--pact-spacing-2);
    padding-right: var(--pact-spacing-10);
    font-size: var(--pact-font-size-sm);
    min-height: 32px;
  `,
  md: css`
    padding: var(--pact-spacing-2) var(--pact-spacing-3);
    padding-right: var(--pact-spacing-10);
    font-size: var(--pact-font-size-base);
    min-height: 40px;
  `,
  lg: css`
    padding: var(--pact-spacing-2_5) var(--pact-spacing-4);
    padding-right: var(--pact-spacing-12);
    font-size: var(--pact-font-size-lg);
    min-height: 48px;
  `
};

// Variant styles
const variants = {
  default: css`
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
  `,
  filled: css`
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
  `,
  ghost: css`
    background-color: transparent;
    color: var(--pact-color-text-primary);
    border-color: transparent;
    border-bottom: 2px solid var(--pact-color-border-primary);
    border-radius: 0;
    box-shadow: none;
    padding-left: 0;
    padding-right: var(--pact-spacing-6);

    &:hover:not(:disabled) {
      border-bottom-color: var(--pact-color-border-hover);
      background-color: var(--pact-color-bg-secondary);
    }

    &:focus {
      border-bottom-color: var(--pact-focus-color);
      background-color: var(--pact-color-bg-secondary);
      box-shadow: 0 1px 0 0 var(--pact-focus-color);
    }

    /* Keep arrow for ghost variant */
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 0 center;
    background-size: 18px;
  `
};

// Error state
const errorStyle = css`
  border-color: var(--pact-color-error) !important;
  background-color: var(--pact-color-error-lighter) !important;

  &:focus {
    border-color: var(--pact-color-error) !important;
    box-shadow: var(--pact-focus-ring-error) !important;
  }
`;

// Helper text styles
const helperTextStyles = css`
  font-size: var(--pact-font-size-sm);
  margin-top: var(--pact-spacing-1);
`;

const helperTextNormal = css`
  color: var(--pact-color-text-secondary);
`;

const helperTextError = css`
  color: var(--pact-color-error);
`;

// Icon container
const iconContainerStyles = css`
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: var(--pact-color-text-secondary);
`;

const iconPaddingSmall = css`
  padding-left: var(--pact-spacing-8);
`;

const iconPaddingMedium = css`
  padding-left: var(--pact-spacing-10);
`;

const iconPaddingLarge = css`
  padding-left: var(--pact-spacing-12);
`;

const iconPositionSmall = css`
  left: var(--pact-spacing-2);
`;

const iconPositionMedium = css`
  left: var(--pact-spacing-3);
`;

const iconPositionLarge = css`
  left: var(--pact-spacing-4);
`;

export const PactSelect: Component<SelectProps> = (props) => {
  const [local, selectProps] = splitProps(props, [
    'variant',
    'size',
    'options',
    'placeholder',
    'error',
    'helperText',
    'label',
    'fullWidth',
    'startIcon',
    'class',
    'value',
    'onChange'
  ]);

  const variant = () => local.variant || 'default';
  const size = () => local.size || 'md';
  const fullWidth = () => local.fullWidth ?? false;
  const hasError = () => !!local.error;
  const errorMessage = () => typeof local.error === 'string' ? local.error : local.helperText;

  // For uncontrolled component, initialize with prop value if provided
  const [internalValue, setInternalValue] = createSignal(local.value || '');

  // Use prop value if controlled, internal value if uncontrolled
  const value = () => local.value !== undefined ? local.value : internalValue();

  const wrapperClass = createMemo(() =>
    clsx(wrapperStyles, fullWidth() && fullWidthStyle)
  );

  const selectClass = createMemo(() =>
    clsx(
      selectBase,
      sizes[size()],
      variants[variant()],
      hasError() && errorStyle,
      local.startIcon && (
        size() === 'sm' ? iconPaddingSmall :
        size() === 'md' ? iconPaddingMedium :
        iconPaddingLarge
      ),
      local.class
    )
  );

  const iconClass = createMemo(() =>
    clsx(
      iconContainerStyles,
      size() === 'sm' ? iconPositionSmall :
      size() === 'md' ? iconPositionMedium :
      iconPositionLarge
    )
  );

  const helperClass = createMemo(() =>
    clsx(
      helperTextStyles,
      hasError() ? helperTextError : helperTextNormal
    )
  );

  const handleChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    // Only update internal value if uncontrolled
    if (local.value === undefined) {
      setInternalValue(target.value);
    }
    if (typeof local.onChange === 'function') {
      local.onChange(e as any);
    }
  };

  // Use a ref to ensure the select value is set correctly
  let selectRef: HTMLSelectElement | undefined;

  createEffect(() => {
    if (selectRef && value()) {
      selectRef.value = String(value());
    }
  });

  return (
    <div class={wrapperClass()}>
      <Show when={local.label}>
        <label class={labelStyles}>{local.label}</label>
      </Show>
      <div class={containerStyles}>
        <Show when={local.startIcon}>
          <span class={iconClass()}>
            {local.startIcon}
          </span>
        </Show>
        <select
          ref={(el) => selectRef = el}
          {...selectProps}
          class={selectClass()}
          value={value()}
          onChange={handleChange}
          aria-invalid={hasError() ? "true" : "false"}
          aria-describedby={errorMessage() ? "select-error" : undefined}
        >
          <Show when={local.placeholder}>
            <option value="" disabled>
              {local.placeholder}
            </option>
          </Show>
          <For each={local.options}>
            {(option) => (
              <option
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            )}
          </For>
        </select>
      </div>
      <Show when={errorMessage()}>
        <span id="select-error" class={helperClass()}>
          {errorMessage()}
        </span>
      </Show>
    </div>
  );
};
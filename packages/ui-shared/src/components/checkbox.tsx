import { Component, JSX, Show, createSignal, createMemo, splitProps } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';
import { generateId } from '../utils/dom';

export type CheckboxSize = 'sm' | 'md' | 'lg';

interface CheckboxProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: CheckboxSize;
  label?: string;
  helperText?: string;
  error?: boolean | string;
  indeterminate?: boolean;
}

// Wrapper styles
const wrapperStyles = css`
  display: inline-flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

// Container styles - Modern interactive
const containerStyles = css`
  display: inline-flex;
  align-items: flex-start;
  gap: var(--pact-spacing-2_5);
  cursor: pointer;
  user-select: none;
  position: relative;

  &:hover input:not(:disabled) ~ .checkbox-box {
    border-color: var(--pact-color-primary);
    background-color: var(--pact-color-primary-lighter);
    transform: scale(1.05);
  }
`;

// Hidden input styles - Enhanced interactions
const inputStyles = css`
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;

  &:checked ~ .checkbox-box {
    background: linear-gradient(135deg, var(--pact-color-primary), var(--pact-color-primary-hover));
    border-color: var(--pact-color-primary);
    box-shadow: var(--pact-shadow-sm);
  }

  &:checked ~ .checkbox-box .checkbox-icon {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }

  &:indeterminate ~ .checkbox-box {
    background: linear-gradient(135deg, var(--pact-color-primary), var(--pact-color-primary-hover));
    border-color: var(--pact-color-primary);
  }

  &:indeterminate ~ .checkbox-box .checkbox-indeterminate {
    opacity: 1;
  }

  &:focus-visible ~ .checkbox-box {
    box-shadow: var(--pact-focus-ring);
    border-color: var(--pact-focus-color);
  }

  &:disabled {
    cursor: not-allowed;
  }

  &:disabled ~ .checkbox-box {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    background-color: var(--pact-color-bg-tertiary);
    border-color: var(--pact-color-border-tertiary);
  }

  &:disabled ~ .checkbox-label {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    color: var(--pact-color-text-muted);
  }
`;

// Checkbox box styles - Modern and refined
const boxBase = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--pact-color-bg-elevated);
  border: 2px solid var(--pact-color-border-secondary);
  border-radius: var(--pact-border-radius-sm);
  transition: all var(--pact-transition-base) cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  box-shadow: var(--pact-input-shadow);
`;

// Size variants
const boxSizes = {
  sm: css`
    width: 16px;
    height: 16px;
  `,
  md: css`
    width: 20px;
    height: 20px;
  `,
  lg: css`
    width: 24px;
    height: 24px;
  `
};

// Error state
const errorBoxStyle = css`
  border-color: var(--pact-color-error) !important;
`;

// Icon styles - Smooth animations
const iconStyles = css`
  position: absolute;
  color: white;
  opacity: 0;
  transform: scale(0.3) rotate(-45deg);
  transition: all var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  filter: var(--pact-drop-shadow-sm);
`;

// Label styles
const labelBase = css`
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-secondary);
  letter-spacing: var(--pact-letter-spacing-wide);
  cursor: pointer;
  transition: opacity var(--pact-transition-fast) var(--pact-transition-timing);
`;

const labelSizes = {
  sm: css`
    font-size: var(--pact-font-size-xs);
  `,
  md: css`
    font-size: var(--pact-font-size-sm);
  `,
  lg: css`
    font-size: var(--pact-font-size-base);
  `
};

// Helper text styles
const helperTextStyles = css`
  font-size: var(--pact-font-size-sm);
  margin-top: var(--pact-spacing-1);
  margin-left: calc(var(--checkbox-size) + var(--pact-spacing-2));
`;

const helperTextNormal = css`
  color: var(--pact-color-text-secondary);
`;

const helperTextError = css`
  color: var(--pact-color-error);
`;

// Checkmark SVG component
const CheckIcon: Component<{ size: CheckboxSize }> = (props) => {
  const sizes = { sm: 12, md: 14, lg: 16 };
  const size = () => sizes[props.size];

  return (
    <svg
      class={`checkbox-icon ${iconStyles}`}
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
};

// Indeterminate icon
const IndeterminateIcon: Component<{ size: CheckboxSize }> = (props) => {
  const sizes = { sm: 12, md: 14, lg: 16 };
  const size = () => sizes[props.size];

  return (
    <svg
      class={`checkbox-indeterminate ${iconStyles}`}
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
};

export const PactCheckbox: Component<CheckboxProps> = (props) => {
  const [local, inputProps] = splitProps(props, [
    'size',
    'label',
    'helperText',
    'error',
    'indeterminate',
    'class',
    'checked',
    'onChange',
    'id'
  ]);

  const size = () => local.size || 'md';
  const hasError = () => !!local.error;
  const errorMessage = () => typeof local.error === 'string' ? local.error : local.helperText;
  const [internalChecked, setInternalChecked] = createSignal(local.checked || false);
  const inputId = local.id || generateId('checkbox');

  // Use controlled state if provided, otherwise use internal state
  const isChecked = () => local.checked !== undefined ? local.checked : internalChecked();

  const boxClass = createMemo(() =>
    clsx(
      'checkbox-box',
      boxBase,
      boxSizes[size()],
      hasError() && errorBoxStyle
    )
  );

  const labelClass = createMemo(() =>
    clsx(
      'checkbox-label',
      labelBase,
      labelSizes[size()]
    )
  );

  const helperClass = createMemo(() =>
    clsx(
      helperTextStyles,
      hasError() ? helperTextError : helperTextNormal
    )
  );

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (local.checked === undefined) {
      setInternalChecked(target.checked);
    }
    if (local.onChange) {
      (local.onChange as any)(e);
    }
  };

  // Set indeterminate state
  const setIndeterminate = (el: HTMLInputElement) => {
    if (local.indeterminate !== undefined) {
      el.indeterminate = local.indeterminate;
    }
  };

  return (
    <div class={wrapperStyles}>
      <label class={containerStyles} for={inputId}>
        <input
          {...inputProps}
          ref={setIndeterminate}
          type="checkbox"
          id={inputId}
          class={inputStyles}
          checked={isChecked()}
          onChange={handleChange}
          aria-invalid={hasError() ? "true" : "false"}
          aria-describedby={errorMessage() ? `${inputId}-error` : undefined}
        />
        <span class={boxClass()}>
          <CheckIcon size={size()} />
          <IndeterminateIcon size={size()} />
        </span>
        <Show when={local.label}>
          <span class={labelClass()}>{local.label}</span>
        </Show>
      </label>
      <Show when={errorMessage()}>
        <span id={`${inputId}-error`} class={helperClass()}>
          {errorMessage()}
        </span>
      </Show>
    </div>
  );
};
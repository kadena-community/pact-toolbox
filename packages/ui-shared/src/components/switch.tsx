import { Component, JSX, Show, splitProps, createMemo, createSignal } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';
import { generateId } from '../utils/dom';

export type SwitchSize = "sm" | "md" | "lg";

interface SwitchProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: SwitchSize;
  label?: string;
  helperText?: string;
  error?: string | boolean;
}

const switchWrapperStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const switchContainerStyles = css`
  display: flex;
  align-items: center;
  gap: var(--pact-spacing-2);
`;

const switchTrackStyles = css`
  position: relative;
  display: inline-block;
  cursor: pointer;
  border-radius: 9999px;
  transition: all var(--pact-transition-base) cubic-bezier(0.4, 0, 0.2, 1);
  background-color: var(--pact-color-gray-300);
  border: 2px solid transparent;
  box-shadow: var(--pact-input-shadow);

  &:hover {
    background-color: var(--pact-color-gray-400);
  }

  &:focus-within {
    box-shadow: var(--pact-focus-ring);
  }

  &.disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    background-color: var(--pact-color-bg-tertiary);
  }

  &.checked {
    background: linear-gradient(135deg, var(--pact-color-primary), var(--pact-color-primary-hover));
    border-color: transparent;
    box-shadow: var(--pact-shadow-sm);
  }

  &.checked:hover {
    background: linear-gradient(135deg, var(--pact-color-primary-hover), var(--pact-color-primary-active));
  }
`;

const switchThumbStyles = css`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: white;
  border-radius: 50%;
  box-shadow: var(--pact-shadow-sm);
  transition: all var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
  border: none;

  &.checked {
    background-color: white;
    box-shadow: var(--pact-shadow);
  }

  &:active {
    transform: translateY(-50%) scale(1.1);
  }
`;

const switchInputStyles = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

// Size styles
const switchSizeSmall = css`
  width: 32px;
  height: 20px;

  .thumb {
    width: 14px;
    height: 14px;
    left: 2px;
  }

  .thumb.checked {
    transform: translateY(-50%) translateX(12px);
  }
`;

const switchSizeMedium = css`
  width: 40px;
  height: 24px;

  .thumb {
    width: 18px;
    height: 18px;
    left: 2px;
  }

  .thumb.checked {
    transform: translateY(-50%) translateX(16px);
  }
`;

const switchSizeLarge = css`
  width: 48px;
  height: 28px;

  .thumb {
    width: 22px;
    height: 22px;
    left: 2px;
  }

  .thumb.checked {
    transform: translateY(-50%) translateX(20px);
  }
`;

const labelStyles = css`
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-secondary);
  letter-spacing: var(--pact-letter-spacing-wide);
  cursor: pointer;
  transition: opacity var(--pact-transition-fast) var(--pact-transition-timing);
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

export const PactSwitch: Component<SwitchProps> = (props) => {
  const [local, inputProps] = splitProps(props, [
    'size',
    'label',
    'helperText',
    'error',
    'id',
    'checked',
    'onChange'
  ]);

  const size = () => local.size || 'md';
  const hasError = () => !!local.error;
  const errorMessage = () => typeof local.error === 'string' ? local.error : local.helperText;
  const switchId = local.id || generateId('switch');
  const [internalChecked, setInternalChecked] = createSignal(local.checked || false);

  // Use controlled state if provided, otherwise use internal state
  const isChecked = () => local.checked !== undefined ? local.checked : internalChecked();

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (local.checked === undefined) {
      setInternalChecked(target.checked);
    }
    if (local.onChange) {
      (local.onChange as any)(e);
    }
  };

  const trackClasses = createMemo(() => clsx(
    switchTrackStyles,
    size() === 'sm' && switchSizeSmall,
    size() === 'md' && switchSizeMedium,
    size() === 'lg' && switchSizeLarge,
    isChecked() && 'checked',
    inputProps.disabled && 'disabled'
  ));

  const thumbClasses = createMemo(() => clsx(
    switchThumbStyles,
    'thumb',
    isChecked() && 'checked'
  ));

  const helperClasses = createMemo(() => clsx(
    helperTextStyles,
    hasError() ? helperTextError : helperTextNormal
  ));

  return (
    <div class={switchWrapperStyles}>
      <div class={switchContainerStyles}>
        <div>
          <input
            {...inputProps}
            id={switchId}
            type="checkbox"
            class={switchInputStyles}
            checked={isChecked()}
            onChange={handleChange}
            aria-invalid={hasError() ? "true" : "false"}
            aria-describedby={errorMessage() ? `${switchId}-helper` : undefined}
          />
          <label
            for={switchId}
            class={trackClasses()}
          >
            <span class={thumbClasses()} />
          </label>
        </div>
        <Show when={local.label}>
          <label for={switchId} class={labelStyles}>
            {local.label}
          </label>
        </Show>
      </div>
      <Show when={errorMessage()}>
        <span id={`${switchId}-helper`} class={helperClasses()}>
          {errorMessage()}
        </span>
      </Show>
    </div>
  );
};
import { Component, JSX, Show, splitProps, createMemo, createContext, useContext, For } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';
import { generateId } from '../utils/dom';

export type RadioSize = "sm" | "md" | "lg";

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
  helperText?: string;
}

interface RadioProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: RadioSize;
  label?: string;
  helperText?: string;
  error?: string | boolean;
}

interface RadioGroupProps {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  size?: RadioSize;
  label?: string;
  helperText?: string;
  error?: string | boolean;
  options: RadioOption[];
  orientation?: 'horizontal' | 'vertical';
  class?: string;
}

const RadioContext = createContext<{
  name: string;
  value: () => string | undefined;
  onChange: (value: string) => void;
  size: () => RadioSize;
}>();

const radioWrapperStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const radioContainerStyles = css`
  display: inline-flex;
  align-items: flex-start;
  gap: var(--pact-spacing-2_5);
  cursor: pointer;
  user-select: none;
  position: relative;

  &:hover input:not(:disabled) ~ .radio-indicator {
    border-color: var(--pact-color-primary);
    background-color: var(--pact-color-primary-lighter);
    transform: scale(1.05);
  }
`;

const radioInputWrapperStyles = css`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const radioInputStyles = css`
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

const radioIndicatorStyles = css`
  position: relative;
  border-radius: 50%;
  border: 2px solid var(--pact-color-border-secondary);
  background-color: var(--pact-color-bg-elevated);
  cursor: pointer;
  transition: all var(--pact-transition-base) cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: var(--pact-input-shadow);

  &:hover {
    border-color: var(--pact-color-primary);
    background-color: var(--pact-color-primary-lighter);
    transform: scale(1.05);
  }

  &:focus-within {
    box-shadow: var(--pact-focus-ring);
  }

  input:disabled + & {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    background-color: var(--pact-color-bg-tertiary);
  }

  input:checked + & {
    background: linear-gradient(135deg, var(--pact-color-primary), var(--pact-color-primary-hover));
    border-color: var(--pact-color-primary);
    box-shadow: var(--pact-shadow-sm);
  }

  input:checked:hover + & {
    background: linear-gradient(135deg, var(--pact-color-primary-hover), var(--pact-color-primary-active));
  }
`;

const radioIndicatorInnerStyles = css`
  border-radius: 50%;
  background-color: white;
  opacity: 0;
  transition: all var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
  transform: scale(0.3);
  filter: var(--pact-drop-shadow-sm);

  input:checked ~ & {
    opacity: 1;
    transform: scale(1);
  }
`;

// Size styles
const radioSizeSmall = css`
  width: 16px;
  height: 16px;

  .inner {
    width: 6px;
    height: 6px;
  }
`;

const radioSizeMedium = css`
  width: 20px;
  height: 20px;

  .inner {
    width: 8px;
    height: 8px;
  }
`;

const radioSizeLarge = css`
  width: 24px;
  height: 24px;

  .inner {
    width: 10px;
    height: 10px;
  }
`;

const labelStyles = css`
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-secondary);
  letter-spacing: var(--pact-letter-spacing-wide);
  cursor: pointer;
  flex: 1;
  transition: opacity var(--pact-transition-fast) var(--pact-transition-timing);
`;

const labelContentStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
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

const radioGroupStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const radioGroupItemsHorizontal = css`
  display: flex;
  flex-direction: row;
  gap: var(--pact-spacing-4);
`;

const radioGroupItemsVertical = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-2);
`;

const radioGroupLabelStyles = css`
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-secondary);
  letter-spacing: var(--pact-letter-spacing-wide);
  margin-bottom: var(--pact-spacing-1);
`;

export const PactRadio: Component<RadioProps> = (props) => {
  const [local, inputProps] = splitProps(props, [
    'size',
    'label',
    'helperText',
    'error',
    'id'
  ]);

  const context = useContext(RadioContext);
  const size = () => local.size || context?.size() || 'md';
  const hasError = () => !!local.error;
  const errorMessage = () => typeof local.error === 'string' ? local.error : local.helperText;
  const radioId = local.id || generateId('radio');

  const indicatorClasses = createMemo(() => clsx(
    radioIndicatorStyles,
    size() === 'sm' && radioSizeSmall,
    size() === 'md' && radioSizeMedium,
    size() === 'lg' && radioSizeLarge
  ));

  const innerClasses = createMemo(() => clsx(
    radioIndicatorInnerStyles,
    'inner'
  ));

  const helperClasses = createMemo(() => clsx(
    helperTextStyles,
    hasError() ? helperTextError : helperTextNormal
  ));

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (context?.onChange) {
      context.onChange(target.value);
    }
    if (inputProps.onChange) {
      (inputProps.onChange as any)(e);
    }
  };

  return (
    <div class={radioWrapperStyles}>
      <div class={radioContainerStyles}>
        <div class={radioInputWrapperStyles}>
          <input
            {...inputProps}
            id={radioId}
            type="radio"
            name={context?.name || inputProps.name}
            checked={context ? context.value() === inputProps.value : inputProps.checked}
            class={radioInputStyles}
            aria-invalid={hasError() ? "true" : "false"}
            aria-describedby={errorMessage() ? `${radioId}-helper` : undefined}
            onChange={handleChange}
          />
          <label
            for={radioId}
            class={clsx(indicatorClasses(), 'radio-indicator')}
          >
            <span class={innerClasses()} />
          </label>
        </div>
        <Show when={local.label}>
          <label for={radioId} class={labelStyles}>
            <div class={labelContentStyles}>
              <span>{local.label}</span>
              <Show when={local.helperText && !hasError()}>
                <span class={clsx(helperTextStyles, helperTextNormal)}>
                  {local.helperText}
                </span>
              </Show>
            </div>
          </label>
        </Show>
      </div>
      <Show when={hasError() && errorMessage()}>
        <span id={`${radioId}-helper`} class={helperClasses()}>
          {errorMessage()}
        </span>
      </Show>
    </div>
  );
};

export const PactRadioGroup: Component<RadioGroupProps> = (props) => {
  const [local, otherProps] = splitProps(props, [
    'name',
    'value',
    'defaultValue',
    'onChange',
    'size',
    'label',
    'helperText',
    'error',
    'options',
    'orientation',
    'class'
  ]);

  const size = () => local.size || 'md';
  const orientation = () => local.orientation || 'vertical';
  const hasError = () => !!local.error;
  const errorMessage = () => typeof local.error === 'string' ? local.error : local.helperText;

  let internalValue = local.defaultValue || '';
  const getValue = () => local.value !== undefined ? local.value : internalValue;

  const handleChange = (value: string) => {
    if (local.value === undefined) {
      internalValue = value;
    }
    local.onChange?.(value);
  };

  const contextValue = {
    name: local.name,
    value: getValue,
    onChange: handleChange,
    size
  };

  const itemsClasses = createMemo(() => clsx(
    orientation() === 'horizontal' ? radioGroupItemsHorizontal : radioGroupItemsVertical
  ));

  const helperClasses = createMemo(() => clsx(
    helperTextStyles,
    hasError() ? helperTextError : helperTextNormal
  ));

  return (
    <RadioContext.Provider value={contextValue}>
      <div class={clsx(radioGroupStyles, local.class)} {...otherProps}>
        <Show when={local.label}>
          <div class={radioGroupLabelStyles}>
            {local.label}
          </div>
        </Show>
        <div class={itemsClasses()} role="radiogroup">
          <For each={local.options}>
            {(option) => (
              <PactRadio
                value={option.value}
                label={option.label}
                disabled={option.disabled}
                helperText={option.helperText}
                size={size()}
              />
            )}
          </For>
        </div>
        <Show when={errorMessage()}>
          <span class={helperClasses()}>
            {errorMessage()}
          </span>
        </Show>
      </div>
    </RadioContext.Provider>
  );
};
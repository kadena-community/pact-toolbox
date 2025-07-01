import { Component, JSX, createMemo, splitProps, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { css, keyframes } from 'goober';
import { clsx } from 'clsx';

export type ProgressSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ProgressVariant = "primary" | "secondary" | "success" | "warning" | "error" | "info";

interface ProgressProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  size?: ProgressSize;
  variant?: ProgressVariant;
  indeterminate?: boolean;
  showLabel?: boolean;
  label?: string;
  children?: JSX.Element;
}

// Keyframes for indeterminate animation
const indeterminateAnimation = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
`;

// Base progress styles
const progressBase = css`
  width: 100%;
  background-color: var(--pact-color-bg-secondary);
  border-radius: var(--pact-border-radius-full);
  overflow: hidden;
  position: relative;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
`;

// Size styles - aligned with spinner sizes
const sizes = {
  xs: css`
    height: 2px;
  `,
  sm: css`
    height: 4px;
  `,
  md: css`
    height: 6px;
  `,
  lg: css`
    height: 8px;
  `,
  xl: css`
    height: 12px;
  `
};

// Progress bar styles
const progressBarBase = css`
  height: 100%;
  border-radius: inherit;
  transition: width var(--pact-transition-normal) var(--pact-transition-timing);
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`;

// Variant styles - aligned with spinner variants
const variants = {
  primary: css`
    background: linear-gradient(90deg, var(--pact-color-primary), var(--pact-color-primary-hover));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  `,
  secondary: css`
    background: linear-gradient(90deg, var(--pact-color-secondary), var(--pact-color-secondary-hover));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  `,
  success: css`
    background: linear-gradient(90deg, var(--pact-color-success), var(--pact-color-success-hover));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  `,
  warning: css`
    background: linear-gradient(90deg, var(--pact-color-warning), var(--pact-color-warning-hover));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  `,
  error: css`
    background: linear-gradient(90deg, var(--pact-color-error), var(--pact-color-error-hover));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  `,
  info: css`
    background: linear-gradient(90deg, var(--pact-color-info), var(--pact-color-info-hover));
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  `
};

// Indeterminate styles
const indeterminateStyle = css`
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.4),
      transparent
    );
    animation: ${indeterminateAnimation} 1.5s infinite linear;
  }
`;

// Container styles for progress with label
const progressContainer = css`
  width: 100%;
`;

// Label styles
const labelContainer = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--pact-spacing-1);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
`;

const labelText = css`
  font-weight: var(--pact-font-weight-medium);
`;

const labelValue = css`
  font-variant-numeric: tabular-nums;
`;

// Accessibility styles
const srOnly = css`
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

export const PactProgress: Component<ProgressProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'value',
    'max',
    'size',
    'variant',
    'indeterminate',
    'showLabel',
    'label',
    'children',
    'class'
  ]);

  const size = () => local.size || 'md';
  const variant = () => local.variant || 'primary';
  const max = () => local.max || 100;
  const indeterminate = () => local.indeterminate || false;
  const showLabel = () => local.showLabel || false;

  // For indeterminate progress, we'll animate the width
  const [indeterminateValue, setIndeterminateValue] = createSignal(0);

  onMount(() => {
    if (indeterminate()) {
      // Simple indeterminate animation - just set width to 100%
      setIndeterminateValue(100);
    }
  });

  onCleanup(() => {
    // Cleanup if needed in the future
  });

  const normalizedValue = createMemo(() => {
    if (indeterminate()) {
      return indeterminateValue();
    }

    const value = local.value || 0;
    const maxValue = max();

    if (value < 0) return 0;
    if (value > maxValue) return 100;

    return (value / maxValue) * 100;
  });

  const progressContainerClass = createMemo(() =>
    clsx(
      progressContainer,
      local.class
    )
  );

  const progressClass = createMemo(() =>
    clsx(
      progressBase,
      sizes[size()]
    )
  );

  const progressBarClass = createMemo(() =>
    clsx(
      progressBarBase,
      variants[variant()],
      indeterminate() && indeterminateStyle
    )
  );

  const displayValue = createMemo(() => {
    if (indeterminate()) return '';
    const value = local.value || 0;
    return Math.round(value);
  });

  const displayMax = createMemo(() => max());

  const percentageText = createMemo(() => {
    if (indeterminate()) return '';
    const value = local.value || 0;
    const percentage = Math.round((value / max()) * 100);
    return `${percentage}%`;
  });

  return (
    <div {...divProps} class={progressContainerClass()}>
      <Show when={showLabel() || local.label}>
        <div class={labelContainer}>
          <Show when={local.label} fallback={<span />}>
            <span class={labelText}>{local.label}</span>
          </Show>
          <Show when={!indeterminate()}>
            <span class={labelValue}>
              {local.children || percentageText()}
            </span>
          </Show>
        </div>
      </Show>

      <div
        class={progressClass()}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={displayMax()}
        aria-valuenow={indeterminate() ? undefined : displayValue()}
        aria-label={local.label || "Progress"}
        aria-busy={indeterminate() ? "true" : "false"}
      >
        <div
          class={progressBarClass()}
          style={{
            width: `${normalizedValue()}%`
          }}
        />
      </div>

      {/* Screen reader text for indeterminate progress */}
      <Show when={indeterminate()}>
        <span class={srOnly}>Loading...</span>
      </Show>

      {/* Screen reader text for determinate progress */}
      <Show when={!indeterminate()}>
        <span class={srOnly}>
          {displayValue()} of {displayMax()} ({percentageText()})
        </span>
      </Show>
    </div>
  );
};
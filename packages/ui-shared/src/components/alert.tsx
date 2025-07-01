import { Component, JSX, createSignal, createMemo, splitProps, Show } from "solid-js";
import { css } from "goober";
import { clsx } from "clsx";

export type AlertVariant = "primary" | "secondary" | "info" | "success" | "warning" | "error";

interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: JSX.Element;
  dismissible?: boolean;
  onDismiss?: () => void;
  actions?: JSX.Element;
  children?: JSX.Element;
}
// Icon styles
const iconStyle = css`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 1px;
`;

// Base alert styles - Modern and clean
const alertBase = css`
  display: flex;
  padding: var(--pact-spacing-4);
  border-radius: var(--pact-border-radius-lg);
  border: 1px solid;
  position: relative;
  gap: var(--pact-spacing-3);
  align-items: flex-start;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  font-size: var(--pact-font-size-sm);
  line-height: 1.5;
`;

// Variant styles - Flat design with consistent colors
const variants = {
  primary: css`
    background-color: var(--pact-color-primary-lighter);
    border-color: var(--pact-color-primary-light);
    color: var(--pact-color-primary-dark);

    & ${iconStyle} {
      color: var(--pact-color-primary);
    }
  `,
  secondary: css`
    background-color: var(--pact-color-secondary-lighter);
    border-color: var(--pact-color-secondary-light);
    color: var(--pact-color-secondary-dark);

    & ${iconStyle} {
      color: var(--pact-color-secondary);
    }
  `,
  info: css`
    background-color: var(--pact-color-info-lighter);
    border-color: var(--pact-color-info-light);
    color: var(--pact-color-info-dark);

    & ${iconStyle} {
      color: var(--pact-color-info);
    }
  `,
  success: css`
    background-color: var(--pact-color-success-lighter);
    border-color: var(--pact-color-success-light);
    color: var(--pact-color-success-dark);

    & ${iconStyle} {
      color: var(--pact-color-success);
    }
  `,
  warning: css`
    background-color: var(--pact-color-warning-lighter);
    border-color: var(--pact-color-warning-light);
    color: var(--pact-color-warning-dark);

    & ${iconStyle} {
      color: var(--pact-color-warning);
    }
  `,
  error: css`
    background-color: var(--pact-color-error-lighter);
    border-color: var(--pact-color-error-light);
    color: var(--pact-color-error-dark);

    & ${iconStyle} {
      color: var(--pact-color-error);
    }
  `,
};

// Content area styles
const contentStyle = css`
  flex: 1;
  min-width: 0;
`;

// Title styles
const titleStyle = css`
  font-weight: var(--pact-font-weight-semibold);
  font-size: var(--pact-font-size-base);
  margin-bottom: var(--pact-spacing-1);
  line-height: 1.4;
  letter-spacing: -0.01em;
`;

// Message styles
const messageStyle = css`
  line-height: 1.6;
  opacity: 0.9;

  &:last-child {
    margin-bottom: 0;
  }
`;

// Actions styles
const actionsStyle = css`
  display: flex;
  gap: var(--pact-spacing-2);
  margin-top: var(--pact-spacing-3);
  flex-wrap: wrap;
`;

// Dismiss button styles
const dismissButtonStyle = css`
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--pact-spacing-1);
  margin: calc(var(--pact-spacing-1) * -1);
  border-radius: var(--pact-border-radius-sm);
  color: currentColor;
  opacity: 0.6;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 1;
    background-color: var(--pact-color-bg-tertiary);
    transform: rotate(90deg);
  }

  &:active {
    transform: rotate(90deg) scale(var(--pact-active-scale));
  }

  &:focus-visible {
    opacity: 1;
    box-shadow: var(--pact-focus-ring);
  }
`;

// Default icons for each variant
const defaultIcons = {
  primary: () => (
    <svg class={iconStyle} fill="currentColor" viewBox="0 0 20 20">
      <path
        fill-rule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clip-rule="evenodd"
      />
    </svg>
  ),
  secondary: () => (
    <svg class={iconStyle} fill="currentColor" viewBox="0 0 20 20">
      <path
        fill-rule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a1 1 0 011 1v3a1 1 0 01-2 0V6a1 1 0 011-1zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clip-rule="evenodd"
      />
    </svg>
  ),
  info: () => (
    <svg class={iconStyle} fill="currentColor" viewBox="0 0 20 20">
      <path
        fill-rule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clip-rule="evenodd"
      />
    </svg>
  ),
  success: () => (
    <svg class={iconStyle} fill="currentColor" viewBox="0 0 20 20">
      <path
        fill-rule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clip-rule="evenodd"
      />
    </svg>
  ),
  warning: () => (
    <svg class={iconStyle} fill="currentColor" viewBox="0 0 20 20">
      <path
        fill-rule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clip-rule="evenodd"
      />
    </svg>
  ),
  error: () => (
    <svg class={iconStyle} fill="currentColor" viewBox="0 0 20 20">
      <path
        fill-rule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clip-rule="evenodd"
      />
    </svg>
  ),
};

// Close icon component
const CloseIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path d="M.293.293a1 1 0 011.414 0L8 6.586 14.293.293a1 1 0 111.414 1.414L9.414 8l6.293 6.293a1 1 0 01-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 01-1.414-1.414L6.586 8 .293 1.707a1 1 0 010-1.414z" />
  </svg>
);

export const PactAlert: Component<AlertProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    "variant",
    "title",
    "icon",
    "dismissible",
    "onDismiss",
    "actions",
    "children",
    "class",
  ]);

  const [isVisible, setIsVisible] = createSignal(true);

  const variant = () => local.variant || "info";
  const dismissible = () => local.dismissible || false;

  const handleDismiss = () => {
    setIsVisible(false);
    local.onDismiss?.();
  };

  const alertClass = createMemo(() => clsx(alertBase, variants[variant()], local.class));

  const icon = () => local.icon || defaultIcons[variant()]();

  return (
    <Show when={isVisible()}>
      <div {...divProps} class={alertClass()} role="alert" aria-live="polite">
        <Show when={icon()}>{icon()}</Show>

        <div class={contentStyle}>
          <Show when={local.title}>
            <div class={titleStyle}>{local.title}</div>
          </Show>

          <Show when={local.children}>
            <div class={messageStyle}>{local.children}</div>
          </Show>

          <Show when={local.actions}>
            <div class={actionsStyle}>{local.actions}</div>
          </Show>
        </div>

        <Show when={dismissible()}>
          <button type="button" class={dismissButtonStyle} onClick={handleDismiss} aria-label="Dismiss alert">
            <CloseIcon />
          </button>
        </Show>
      </div>
    </Show>
  );
};

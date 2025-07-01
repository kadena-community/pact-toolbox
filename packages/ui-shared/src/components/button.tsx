import { Component, JSX, Show, createMemo, splitProps } from 'solid-js';
import { css, keyframes } from 'goober';
import { clsx } from 'clsx';

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  loadingText?: string;
  startIcon?: JSX.Element;
  endIcon?: JSX.Element;
  children?: JSX.Element;
}

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

// Base button styles - Modern and refined
const buttonBase = css`
  font-family: inherit;
  font-weight: var(--pact-font-weight-medium);
  border: none;
  border-radius: var(--pact-border-radius-md);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--pact-spacing-2);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  position: relative;
  text-decoration: none;
  outline: none;
  user-select: none;
  white-space: nowrap;

  &:focus-visible {
    box-shadow: var(--pact-focus-ring);
  }

  &:active:not(:disabled) {
    transform: scale(var(--pact-active-scale));
  }

  &:disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    filter: saturate(0.7);
  }
`;

// Size styles
const sizes = {
  xs: css`
    padding: var(--pact-spacing-1) var(--pact-spacing-2);
    font-size: var(--pact-font-size-xs);
    min-height: 24px;

    & .button-icon {
      width: 12px;
      height: 12px;
      display: block;
    }
  `,
  sm: css`
    padding: var(--pact-spacing-1_5) var(--pact-spacing-3);
    font-size: var(--pact-font-size-sm);
    min-height: 32px;

    & .button-icon {
      width: 14px;
      height: 14px;
      display: block;
    }
  `,
  md: css`
    padding: var(--pact-spacing-2) var(--pact-spacing-4);
    font-size: var(--pact-font-size-base);
    min-height: 40px;

    & .button-icon {
      width: 16px;
      height: 16px;
      display: block;
    }
  `,
  lg: css`
    padding: var(--pact-spacing-2_5) var(--pact-spacing-6);
    font-size: var(--pact-font-size-lg);
    min-height: 48px;

    & .button-icon {
      width: 18px;
      height: 18px;
      display: block;
    }
  `,
  xl: css`
    padding: var(--pact-spacing-3) var(--pact-spacing-8);
    font-size: var(--pact-font-size-xl);
    min-height: 56px;

    & .button-icon {
      width: 20px;
      height: 20px;
      display: block;
    }
  `
};

// Variant styles - Modern with subtle depth
const variants = {
  primary: css`
    background: linear-gradient(to bottom, var(--pact-color-primary), var(--pact-color-primary));
    color: var(--pact-color-text-inverse);
    box-shadow: var(--pact-button-shadow);
    font-weight: var(--pact-font-weight-medium);

    &:hover:not(:disabled) {
      background: linear-gradient(to bottom, var(--pact-color-primary-hover), var(--pact-color-primary-hover));
      box-shadow: var(--pact-button-shadow-hover);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      box-shadow: var(--pact-button-shadow-active);
      transform: scale(var(--pact-active-scale));
    }
  `,
  secondary: css`
    background-color: var(--pact-color-bg-secondary);
    color: var(--pact-color-text-primary);
    box-shadow: var(--pact-button-shadow);
    border: 1px solid var(--pact-color-border-primary);

    &:hover:not(:disabled) {
      background-color: var(--pact-color-bg-tertiary);
      border-color: var(--pact-color-border-secondary);
      box-shadow: var(--pact-button-shadow-hover);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      box-shadow: var(--pact-button-shadow-active);
      transform: scale(var(--pact-active-scale));
    }
  `,
  ghost: css`
    background-color: transparent;
    color: var(--pact-color-text-secondary);
    font-weight: var(--pact-font-weight-normal);

    &:hover:not(:disabled) {
      background-color: var(--pact-color-bg-secondary);
      color: var(--pact-color-text-primary);
    }

    &:active:not(:disabled) {
      background-color: var(--pact-color-bg-tertiary);
    }
  `,
  danger: css`
    background: linear-gradient(to bottom, var(--pact-color-error), var(--pact-color-error));
    color: var(--pact-color-text-inverse);
    box-shadow: var(--pact-button-shadow);

    &:hover:not(:disabled) {
      background: linear-gradient(to bottom, var(--pact-color-error-hover), var(--pact-color-error-hover));
      box-shadow: var(--pact-button-shadow-hover);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      box-shadow: var(--pact-button-shadow-active);
      transform: scale(var(--pact-active-scale));
    }
  `,
  outline: css`
    background-color: transparent;
    color: var(--pact-color-primary);
    border: 1px solid var(--pact-color-primary);
    font-weight: var(--pact-font-weight-normal);

    &:hover:not(:disabled) {
      background-color: var(--pact-color-primary-lighter);
      border-color: var(--pact-color-primary-hover);
    }

    &:active:not(:disabled) {
      background-color: var(--pact-color-primary-light);
    }
  `,
  link: css`
    background-color: transparent;
    color: var(--pact-color-text-link);
    border: none;
    padding: 0;
    min-height: auto;
    text-decoration: none;
    position: relative;
    font-weight: var(--pact-font-weight-normal);

    &::after {
      content: '';
      position: absolute;
      width: 100%;
      height: 1px;
      bottom: 0;
      left: 0;
      background-color: currentColor;
      transform: scaleX(0);
      transform-origin: bottom right;
      transition: transform 0.25s ease-out;
    }

    &:hover:not(:disabled)::after {
      transform: scaleX(1);
      transform-origin: bottom left;
    }

    &:hover:not(:disabled) {
      color: var(--pact-color-primary-hover);
    }

    &:focus-visible {
      box-shadow: none;
      outline: 2px solid var(--pact-color-border-focus);
      outline-offset: 4px;
      border-radius: var(--pact-border-radius-sm);
    }
  `
};

// Utility styles
const fullWidthStyle = css`
  width: 100%;
`;

const spinnerStyle = css`
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-radius: 50%;
  border-top-color: transparent;
  animation: ${spin} 0.8s linear infinite;
`;

const loaderStyle = css`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const contentVisibleStyle = css`
  visibility: visible;
  display: flex;
  align-items: center;
  gap: var(--pact-spacing-2);
`;

const contentHiddenStyle = css`
  visibility: hidden;
  display: flex;
  align-items: center;
  gap: var(--pact-spacing-2);
`;

export const PactButton: Component<ButtonProps> = (props) => {
  const [local, buttonProps] = splitProps(props, [
    'variant',
    'size',
    'loading',
    'fullWidth',
    'loadingText',
    'startIcon',
    'endIcon',
    'children',
    'disabled',
    'class'
  ]);

  const variant = () => local.variant || 'primary';
  const size = () => local.size || 'md';
  const loading = () => local.loading || false;
  const fullWidth = () => local.fullWidth || false;
  const loadingText = () => local.loadingText || 'Loading...';
  const isDisabled = createMemo(() => local.disabled || loading());

  const handleClick = (e: MouseEvent) => {
    if (isDisabled()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Call the original onClick if provided
    const handler = buttonProps.onClick;
    if (typeof handler === 'function') {
      handler(e as any);
    }
  };

  const buttonClass = createMemo(() =>
    clsx(
      buttonBase,
      sizes[size()],
      variants[variant()],
      fullWidth() && fullWidthStyle,
      local.class
    )
  );

  const contentClass = createMemo(() =>
    clsx(loading() ? contentHiddenStyle : contentVisibleStyle)
  );

  return (
    <button
      {...buttonProps}
      class={buttonClass()}
      disabled={isDisabled()}
      aria-label={buttonProps['aria-label'] || (loading() ? loadingText() : "")}
      aria-busy={loading() ? "true" : "false"}
      onClick={handleClick}
    >
      <Show when={loading()}>
        <span class={loaderStyle} aria-hidden="true">
          <span class={spinnerStyle} />
        </span>
      </Show>
      <span class={contentClass()} aria-hidden={loading() ? "true" : "false"}>
        <Show when={local.startIcon}>
          <span class="button-icon" aria-hidden="true">
            {local.startIcon}
          </span>
        </Show>
        {local.children}
        <Show when={local.endIcon}>
          <span class="button-icon" aria-hidden="true">
            {local.endIcon}
          </span>
        </Show>
      </span>
    </button>
  );
};
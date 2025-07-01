import { Component, JSX, splitProps, createMemo } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type IconButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "link";
export type IconButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  children?: JSX.Element;
  'aria-label': string; // Required for accessibility
}

// Base styles for icon button - matching button component
const iconButtonBase = css`
  font-family: inherit;
  font-weight: var(--pact-font-weight-medium);
  border: none;
  border-radius: var(--pact-border-radius-md);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  position: relative;
  text-decoration: none;
  outline: none;
  user-select: none;
  aspect-ratio: 1;
  flex-shrink: 0;

  &:focus-visible {
    box-shadow: var(--pact-focus-ring);
  }

  &:active:not(:disabled) {
    transform: scale(var(--pact-active-scale));
  }

  &:disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
    transform: none !important;
  }
`;

// Size variants - square dimensions
const sizes = {
  xs: css`
    width: 24px;
    height: 24px;
    font-size: var(--pact-font-size-xs);

    & svg {
      width: 12px;
      height: 12px;
      display: block;
    }
  `,
  sm: css`
    width: 32px;
    height: 32px;
    font-size: var(--pact-font-size-sm);

    & svg {
      width: 16px;
      height: 16px;
      display: block;
    }
  `,
  md: css`
    width: 40px;
    height: 40px;
    font-size: var(--pact-font-size-base);

    & svg {
      width: 18px;
      height: 18px;
      display: block;
    }
  `,
  lg: css`
    width: 48px;
    height: 48px;
    font-size: var(--pact-font-size-lg);

    & svg {
      width: 20px;
      height: 20px;
      display: block;
    }
  `,
  xl: css`
    width: 56px;
    height: 56px;
    font-size: var(--pact-font-size-xl);

    & svg {
      width: 24px;
      height: 24px;
      display: block;
    }
  `
};

// Variant styles - matching button component exactly
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
    font-weight: var(--pact-font-weight-normal);
    text-decoration: none;

    &:hover:not(:disabled) {
      color: var(--pact-color-text-link-hover);
      text-decoration: underline;
    }

    &:active:not(:disabled) {
      color: var(--pact-color-text-link-active);
    }
  `
};

// Loading spinner overlay
const loadingOverlay = css`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: inherit;
  border-radius: inherit;
`;

const LoadingSpinner = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    style={{
      animation: 'spin 0.8s linear infinite'
    }}
  >
    <circle cx="12" cy="12" r="10" stroke-opacity="0.2" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
  </svg>
);

export const PactIconButton: Component<IconButtonProps> = (props) => {
  const [local, buttonProps] = splitProps(props, [
    'variant',
    'size',
    'loading',
    'children',
    'class'
  ]);

  const variant = () => local.variant || 'ghost';
  const size = () => local.size || 'md';
  const loading = () => local.loading || false;

  const buttonClass = createMemo(() => clsx(
    iconButtonBase,
    sizes[size()],
    variants[variant()],
    local.class
  ));

  return (
    <button
      {...buttonProps}
      class={buttonClass()}
      disabled={buttonProps.disabled || loading()}
      type={buttonProps.type || 'button'}
    >
      <span style={{
        opacity: loading() ? '0' : '1',
        transition: 'opacity var(--pact-transition-base) var(--pact-transition-timing)',
        display: 'inline-flex',
        'align-items': 'center',
        'justify-content': 'center'
      }}>
        {local.children}
      </span>

      {loading() && (
        <div class={loadingOverlay}>
          <LoadingSpinner />
        </div>
      )}
    </button>
  );
};
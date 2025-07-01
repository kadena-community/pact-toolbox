import { Component, JSX, splitProps, createMemo } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type BadgeVariant = "default" | "primary" | "success" | "error" | "warning" | "info";
export type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children?: JSX.Element;
}

// Base badge styles - Modern and refined
const badgeBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--pact-font-weight-medium);
  border-radius: var(--pact-border-radius-full);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  white-space: nowrap;
  user-select: none;
  letter-spacing: 0.025em;
  line-height: 1;
  border: 1px solid transparent;
`;

// Size variants - Better proportions
const sizes = {
  sm: css`
    padding: var(--pact-spacing-0_5) var(--pact-spacing-2);
    font-size: var(--pact-font-size-2xs);
    min-height: 18px;
  `,
  md: css`
    padding: var(--pact-spacing-1) var(--pact-spacing-2_5);
    font-size: var(--pact-font-size-xs);
    min-height: 22px;
  `,
  lg: css`
    padding: var(--pact-spacing-1_5) var(--pact-spacing-3);
    font-size: var(--pact-font-size-sm);
    min-height: 26px;
  `
};

// Variant styles - Subtle and modern
const variants = {
  default: css`
    background-color: var(--pact-color-bg-tertiary);
    color: var(--pact-color-text-secondary);
    border-color: var(--pact-color-border-primary);
    box-shadow: var(--pact-shadow-xs);
  `,
  primary: css`
    background-color: var(--pact-color-primary-lighter);
    color: var(--pact-color-primary);
    border-color: var(--pact-color-primary-light);
    font-weight: var(--pact-font-weight-semibold);
  `,
  success: css`
    background-color: var(--pact-color-success-lighter);
    color: var(--pact-color-success);
    border-color: var(--pact-color-success-light);
  `,
  error: css`
    background-color: var(--pact-color-error-lighter);
    color: var(--pact-color-error);
    border-color: var(--pact-color-error-light);
  `,
  warning: css`
    background-color: var(--pact-color-warning-lighter);
    color: var(--pact-color-warning-dark);
    border-color: var(--pact-color-warning-light);
  `,
  info: css`
    background-color: var(--pact-color-info-lighter);
    color: var(--pact-color-info);
    border-color: var(--pact-color-info-light);
  `
};

export const PactBadge: Component<BadgeProps> = (props) => {
  const [local, spanProps] = splitProps(props, ['variant', 'size', 'children', 'class']);

  const variant = () => local.variant || 'default';
  const size = () => local.size || 'md';

  const badgeClass = createMemo(() =>
    clsx(
      badgeBase,
      sizes[size()],
      variants[variant()],
      local.class
    )
  );

  return (
    <span
      {...spanProps}
      class={badgeClass()}
    >
      {local.children}
    </span>
  );
};
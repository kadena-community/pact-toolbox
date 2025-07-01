import { Component, JSX, splitProps, createMemo } from 'solid-js';
import { css, keyframes } from 'goober';
import { clsx } from 'clsx';

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerVariant = "primary" | "secondary" | "success" | "warning" | "error" | "info";

interface SpinnerProps extends JSX.SvgSVGAttributes<SVGSVGElement> {
  size?: SpinnerSize | number;
  variant?: SpinnerVariant;
  color?: string;
  thickness?: number;
}

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const spinnerStyles = css`
  animation: ${spin} 0.8s linear infinite;
  display: inline-block;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
`;

// Size variants to match progress component
const sizes = {
  xs: css`
    width: 12px;
    height: 12px;
  `,
  sm: css`
    width: 16px;
    height: 16px;
  `,
  md: css`
    width: 24px;
    height: 24px;
  `,
  lg: css`
    width: 32px;
    height: 32px;
  `,
  xl: css`
    width: 48px;
    height: 48px;
  `
};

// Color variants to match progress component
const variants = {
  primary: css`
    color: var(--pact-color-primary);
  `,
  secondary: css`
    color: var(--pact-color-secondary);
  `,
  success: css`
    color: var(--pact-color-success);
  `,
  warning: css`
    color: var(--pact-color-warning);
  `,
  error: css`
    color: var(--pact-color-error);
  `,
  info: css`
    color: var(--pact-color-info);
  `
};

export const PactSpinner: Component<SpinnerProps> = (props) => {
  const [local, svgProps] = splitProps(props, ['size', 'variant', 'color', 'thickness']);

  const getSize = () => {
    if (typeof local.size === 'number') return local.size;
    return local.size || 'md';
  };

  const variant = () => local.variant || 'primary';
  const color = () => local.color;
  const thickness = () => local.thickness || 2.5;

  const classes = createMemo(() => clsx(
    spinnerStyles,
    typeof getSize() === 'string' && sizes[getSize() as SpinnerSize],
    !color() && variants[variant()],
    svgProps.class
  ));

  const sizeValue = () => typeof getSize() === 'number' ? getSize() as number : 24;

  return (
    <svg
      {...svgProps}
      class={classes()}
      width={typeof getSize() === 'number' ? sizeValue() : undefined}
      height={typeof getSize() === 'number' ? sizeValue() : undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color() || 'currentColor'}
      stroke-width={thickness()}
      aria-label="Loading"
      role="status"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke-opacity="0.2"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke-linecap="round"
        stroke-opacity="1"
      />
    </svg>
  );
};
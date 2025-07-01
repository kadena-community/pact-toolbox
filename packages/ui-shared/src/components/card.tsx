import { Component, JSX, splitProps, createMemo } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  clickable?: boolean;
  selected?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "compact";
  header?: JSX.Element;
  footer?: JSX.Element;
  children?: JSX.Element;
}

// Base card styles - Clean and modern
const cardBase = css`
  background-color: var(--pact-color-bg-elevated);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-lg);
  box-shadow: var(--pact-card-shadow);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  height: 100%;
  position: relative;
  overflow: hidden;
`;

// Padding variants - More generous spacing
const paddings = {
  none: css`
    padding: 0;
  `,
  sm: css`
    padding: var(--pact-spacing-3);
  `,
  md: css`
    padding: var(--pact-spacing-4);
  `,
  lg: css`
    padding: var(--pact-spacing-6);
  `
};

// Interactive styles - Smooth and subtle
const hoverableStyle = css`
  &:hover {
    box-shadow: var(--pact-card-shadow-hover);
    transform: translateY(-1px);
    border-color: var(--pact-color-border-hover);
  }
`;

const clickableStyle = css`
  cursor: pointer;
  user-select: none;

  &:active {
    transform: translateY(0);
    box-shadow: var(--pact-card-shadow);
  }
`;

// Selected state styles
const selectedStyle = css`
  border-color: var(--pact-color-primary);
  background-color: var(--pact-color-primary-alpha-5);
  box-shadow: 0 0 0 1px var(--pact-color-primary);

  &:hover {
    border-color: var(--pact-color-primary);
    box-shadow: 0 0 0 1px var(--pact-color-primary), var(--pact-card-shadow-hover);
  }
`;

const compactSelectedStyle = css`
  border-color: var(--pact-color-primary);
  background-color: var(--pact-color-primary-alpha-5);
  box-shadow: 0 0 0 1px var(--pact-color-primary);

  &:hover {
    border-color: var(--pact-color-primary);
    box-shadow: 0 0 0 1px var(--pact-color-primary), var(--pact-card-shadow-hover);
  }
`;

// Header styles for different padding sizes
const cardHeaderStyles = {
  none: css`
    margin: 0;
    padding: var(--pact-spacing-5) var(--pact-spacing-6);
    border-bottom: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
  `,
  sm: css`
    margin: calc(var(--pact-spacing-3) * -1);
    margin-bottom: var(--pact-spacing-3);
    padding: var(--pact-spacing-3);
    border-bottom: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
  `,
  md: css`
    margin: calc(var(--pact-spacing-4) * -1);
    margin-bottom: var(--pact-spacing-4);
    padding: var(--pact-spacing-4);
    border-bottom: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
  `,
  lg: css`
    margin: calc(var(--pact-spacing-6) * -1);
    margin-bottom: var(--pact-spacing-6);
    padding: var(--pact-spacing-6);
    border-bottom: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 64px;
  `
};

// Compact variant styles - optimized for list items
const compactCardBase = css`
  background-color: var(--pact-color-bg-elevated);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  position: relative;
  overflow: hidden;
`;

const compactPaddings = {
  none: css`
    padding: 0;
  `,
  sm: css`
    padding: var(--pact-spacing-2);
  `,
  md: css`
    padding: var(--pact-spacing-3);
  `,
  lg: css`
    padding: var(--pact-spacing-4);
  `
};

// Footer styles for different padding sizes
const cardFooterStyles = {
  none: css`
    margin: 0;
    padding: var(--pact-spacing-4) var(--pact-spacing-6) var(--pact-spacing-5);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-3);
    min-height: 64px;
  `,
  sm: css`
    margin: calc(var(--pact-spacing-3) * -1);
    margin-top: var(--pact-spacing-3);
    padding: var(--pact-spacing-3);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-3);
    min-height: 64px;
  `,
  md: css`
    margin: calc(var(--pact-spacing-4) * -1);
    margin-top: var(--pact-spacing-4);
    padding: var(--pact-spacing-4);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-3);
    min-height: 64px;
  `,
  lg: css`
    margin: calc(var(--pact-spacing-6) * -1);
    margin-top: var(--pact-spacing-6);
    padding: var(--pact-spacing-6);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-accent);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-3);
    min-height: 64px;
  `
};

// Compact footer styles
const compactFooterStyles = {
  none: css`
    margin: 0;
    padding: var(--pact-spacing-2) var(--pact-spacing-3);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-surface);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-2);
    min-height: 44px;
  `,
  sm: css`
    margin: calc(var(--pact-spacing-2) * -1);
    margin-top: var(--pact-spacing-2);
    padding: var(--pact-spacing-2);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-surface);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-2);
    min-height: 44px;
  `,
  md: css`
    margin: calc(var(--pact-spacing-3) * -1);
    margin-top: var(--pact-spacing-3);
    padding: var(--pact-spacing-2) var(--pact-spacing-3);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-surface);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-2);
    min-height: 44px;
  `,
  lg: css`
    margin: calc(var(--pact-spacing-4) * -1);
    margin-top: var(--pact-spacing-4);
    padding: var(--pact-spacing-2) var(--pact-spacing-4);
    border-top: 1px solid var(--pact-color-border-primary);
    background-color: var(--pact-color-bg-surface);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--pact-spacing-2);
    min-height: 44px;
  `
};

export const PactCard: Component<CardProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'hoverable',
    'clickable',
    'selected',
    'padding',
    'variant',
    'header',
    'footer',
    'children',
    'class'
  ]);

  const hoverable = () => local.hoverable || false;
  const clickable = () => local.clickable || false;
  const selected = () => local.selected || false;
  const padding = () => local.padding || 'md';
  const variant = () => local.variant || 'default';
  const isCompact = () => variant() === 'compact';

  const cardClass = createMemo(() =>
    clsx(
      isCompact() ? compactCardBase : cardBase,
      isCompact() ? compactPaddings[padding()] : paddings[padding()],
      hoverable() && hoverableStyle,
      clickable() && clickableStyle,
      selected() && (isCompact() ? compactSelectedStyle : selectedStyle),
      local.class
    )
  );

  return (
    <div
      {...divProps}
      class={cardClass()}
    >
      {local.header && (
        <div class={cardHeaderStyles[padding()]}>
          {local.header}
        </div>
      )}
      {local.children}
      {local.footer && (
        <div class={isCompact() ? compactFooterStyles[padding()] : cardFooterStyles[padding()]}>
          {local.footer}
        </div>
      )}
    </div>
  );
};
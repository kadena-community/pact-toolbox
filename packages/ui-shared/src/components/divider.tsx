import { Component, JSX, createMemo, splitProps, Show } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type DividerOrientation = "horizontal" | "vertical";
export type DividerVariant = "solid" | "dashed" | "dotted";
export type DividerThickness = "1" | "2" | "4";

interface DividerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation;
  variant?: DividerVariant;
  thickness?: DividerThickness;
  children?: JSX.Element;
}

// Base divider styles
const dividerBase = css`
  border: none;
  margin: 0;
  flex-shrink: 0;
  background-color: transparent;
  display: flex;
  align-items: center;
  position: relative;
`;

// Orientation styles
const horizontalStyles = css`
  width: 100%;
  flex-direction: row;
  margin: var(--pact-spacing-md) 0;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: var(--divider-thickness);
    background-color: var(--pact-color-border-primary);
  }
`;

const verticalStyles = css`
  height: 100%;
  flex-direction: column;
  margin: 0 var(--pact-spacing-md);
  min-height: 32px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    width: var(--divider-thickness);
    background-color: var(--pact-color-border-primary);
  }
`;

// Variant styles for border style
const variants = {
  solid: css`
    --divider-style: solid;
  `,
  dashed: css`
    --divider-style: dashed;
  `,
  dotted: css`
    --divider-style: dotted;
  `
};

// Thickness styles
const thicknesses = {
  "1": css`
    --divider-thickness: 1px;
  `,
  "2": css`
    --divider-thickness: 2px;
  `,
  "4": css`
    --divider-thickness: 4px;
  `
};

// Styles for dividers with content
const horizontalWithContent = css`
  &::before,
  &::after {
    border-top: var(--divider-thickness) var(--divider-style, solid) var(--pact-color-border-primary);
    background: none;
    height: 0;
  }
`;

const verticalWithContent = css`
  &::before,
  &::after {
    border-left: var(--divider-thickness) var(--divider-style, solid) var(--pact-color-border-primary);
    background: none;
    width: 0;
  }
`;

// Styles for dividers without content - removed unused styles

// Content styles
const contentStyles = css`
  padding: 0 var(--pact-spacing-sm);
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
  font-weight: var(--pact-font-weight-medium);
  white-space: nowrap;
  background-color: var(--pact-color-bg-primary);
`;

const verticalContentStyles = css`
  padding: var(--pact-spacing-sm) 0;
  writing-mode: vertical-rl;
  text-orientation: mixed;
`;

// Simple divider without content (just a line)
const simpleDividerHorizontal = css`
  width: 100%;
  height: var(--divider-thickness);
  background-color: var(--pact-color-border-primary);
  margin: var(--pact-spacing-md) 0;

  &.dashed {
    background-image: repeating-linear-gradient(
      to right,
      var(--pact-color-border-primary) 0,
      var(--pact-color-border-primary) 8px,
      transparent 8px,
      transparent 16px
    );
    background-color: transparent;
  }

  &.dotted {
    background-image: repeating-linear-gradient(
      to right,
      var(--pact-color-border-primary) 0,
      var(--pact-color-border-primary) 2px,
      transparent 2px,
      transparent 6px
    );
    background-color: transparent;
  }
`;

const simpleDividerVertical = css`
  height: 100%;
  width: var(--divider-thickness);
  background-color: var(--pact-color-border-primary);
  margin: 0 var(--pact-spacing-md);
  min-height: 32px;

  &.dashed {
    background-image: repeating-linear-gradient(
      to bottom,
      var(--pact-color-border-primary) 0,
      var(--pact-color-border-primary) 8px,
      transparent 8px,
      transparent 16px
    );
    background-color: transparent;
  }

  &.dotted {
    background-image: repeating-linear-gradient(
      to bottom,
      var(--pact-color-border-primary) 0,
      var(--pact-color-border-primary) 2px,
      transparent 2px,
      transparent 6px
    );
    background-color: transparent;
  }
`;

export const PactDivider: Component<DividerProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'orientation',
    'variant',
    'thickness',
    'children',
    'class'
  ]);

  const orientation = () => local.orientation || 'horizontal';
  const variant = () => local.variant || 'solid';
  const thickness = () => local.thickness || '1';
  const hasContent = () => !!local.children;

  const dividerClass = createMemo(() => {
    const isHorizontal = orientation() === 'horizontal';
    const variantClass = variant();

    if (!hasContent()) {
      // Simple divider without content
      return clsx(
        isHorizontal ? simpleDividerHorizontal : simpleDividerVertical,
        variants[variant()],
        thicknesses[thickness()],
        variantClass !== 'solid' && variantClass,
        local.class
      );
    }

    // Divider with content
    return clsx(
      dividerBase,
      isHorizontal ? horizontalStyles : verticalStyles,
      isHorizontal ? horizontalWithContent : verticalWithContent,
      variants[variant()],
      thicknesses[thickness()],
      local.class
    );
  });

  const contentClass = createMemo(() =>
    clsx(
      contentStyles,
      orientation() === 'vertical' && verticalContentStyles
    )
  );

  // If no content, render simple divider
  return (
    <Show
      when={hasContent()}
      fallback={
        <div
          {...divProps}
          class={dividerClass()}
          role="separator"
          aria-orientation={orientation()}
        />
      }
    >
      <div
        {...divProps}
        class={dividerClass()}
        role="separator"
        aria-orientation={orientation()}
      >
        <span class={contentClass()}>
          {local.children}
        </span>
      </div>
    </Show>
  );
};
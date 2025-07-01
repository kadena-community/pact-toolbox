import { JSX, Show, splitProps } from "solid-js";
import { css } from "goober";
import clsx from "clsx";
import { PactButton } from "./button";

export interface PactEmptyStateProps {
  icon?: JSX.Element;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: "small" | "medium" | "large";
  class?: string;
}

const emptyStateStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;

  &.size-small {
    padding: var(--pact-spacing-lg);
    min-height: 200px;
  }

  &.size-medium {
    padding: var(--pact-spacing-xl);
    min-height: 300px;
  }

  &.size-large {
    padding: var(--pact-spacing-2xl);
    min-height: 400px;
  }
`;

const iconContainerStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--pact-spacing-md);
  color: var(--pact-color-text-tertiary);

  &.size-small {
    width: 48px;
    height: 48px;
    font-size: 24px;
  }

  &.size-medium {
    width: 64px;
    height: 64px;
    font-size: 32px;
  }

  &.size-large {
    width: 80px;
    height: 80px;
    font-size: 40px;
  }

  svg {
    width: 100%;
    height: 100%;
  }
`;

const titleStyles = css`
  font-weight: 600;
  color: var(--pact-color-text-primary);
  margin-bottom: var(--pact-spacing-sm);

  &.size-small {
    font-size: var(--pact-font-size-lg);
  }

  &.size-medium {
    font-size: var(--pact-font-size-xl);
  }

  &.size-large {
    font-size: var(--pact-font-size-2xl);
  }
`;

const descriptionStyles = css`
  color: var(--pact-color-text-secondary);
  max-width: 400px;
  margin-bottom: var(--pact-spacing-lg);

  &.size-small {
    font-size: var(--pact-font-size-sm);
  }

  &.size-medium {
    font-size: var(--pact-font-size-base);
  }

  &.size-large {
    font-size: var(--pact-font-size-lg);
  }
`;

const actionsStyles = css`
  display: flex;
  gap: var(--pact-spacing-sm);
  align-items: center;
  justify-content: center;
`;

export function PactEmptyState(props: PactEmptyStateProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "icon",
    "title",
    "description",
    "action",
    "secondaryAction",
    "size",
    "class",
  ]);

  const size = () => local.size || "medium";

  return (
    <div
      class={clsx(
        emptyStateStyles,
        `size-${size()}`,
        local.class
      )}
      {...rest}
    >
      <Show when={local.icon}>
        <div class={clsx(iconContainerStyles, `size-${size()}`)}>
          {local.icon}
        </div>
      </Show>

      <h3 class={clsx(titleStyles, `size-${size()}`)}>
        {local.title}
      </h3>

      <Show when={local.description}>
        <p class={clsx(descriptionStyles, `size-${size()}`)}>
          {local.description}
        </p>
      </Show>

      <Show when={local.action || local.secondaryAction}>
        <div class={actionsStyles}>
          <Show when={local.action}>
            <PactButton
              variant="primary"
              size={size() === "small" ? "sm" : size() === "large" ? "lg" : "md"}
              onClick={local.action!.onClick}
            >
              {local.action!.label}
            </PactButton>
          </Show>

          <Show when={local.secondaryAction}>
            <PactButton
              variant="secondary"
              size={size() === "small" ? "sm" : size() === "large" ? "lg" : "md"}
              onClick={local.secondaryAction!.onClick}
            >
              {local.secondaryAction!.label}
            </PactButton>
          </Show>
        </div>
      </Show>
    </div>
  );
}
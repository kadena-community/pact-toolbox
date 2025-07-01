import { For, JSX, Show, splitProps } from "solid-js";
import { css, keyframes } from "goober";
import clsx from "clsx";

export interface ListItem {
  id: string | number;
  [key: string]: any;
}

export interface PactListProps<T extends ListItem> {
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  onItemClick?: (item: T, index: number) => void;
  selectedId?: string | number;
  emptyMessage?: string;
  loading?: boolean;
  virtualized?: boolean;
  itemHeight?: number;
  class?: string;
  variant?: "default" | "compact" | "spacious";
  dividers?: boolean;
}

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

const listStyles = css`
  display: flex;
  flex-direction: column;
  width: 100%;

  &.variant-default {
    gap: var(--pact-spacing-sm);
  }

  &.variant-compact {
    gap: 0;
  }

  &.variant-spacious {
    gap: var(--pact-spacing-md);
  }
`;

const listItemStyles = css`
  display: flex;
  align-items: center;
  width: 100%;
  transition: all var(--pact-transition-fast);

  &.clickable {
    cursor: pointer;

    &:hover {
      background: var(--pact-color-bg-secondary);
    }

    &:active {
      transform: scale(0.99);
    }
  }

  &.selected {
    background: var(--pact-color-primary-lighter);
    border-left: 3px solid var(--pact-color-primary);
  }

  &.divider {
    border-bottom: 1px solid var(--pact-color-border-primary);

    &:last-child {
      border-bottom: none;
    }
  }
`;

const emptyStateStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--pact-spacing-2xl);
  color: var(--pact-color-text-tertiary);
  text-align: center;
  min-height: 200px;
`;

const loadingStateStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-sm);
`;

const skeletonStyles = css`
  height: 60px;
  background: linear-gradient(
    90deg,
    var(--pact-color-bg-secondary) 25%,
    var(--pact-color-bg-tertiary) 50%,
    var(--pact-color-bg-secondary) 75%
  );
  background-size: 200px 100%;
  animation: ${shimmer} 1.5s infinite;
  border-radius: var(--pact-border-radius-base);
`;

export function PactList<T extends ListItem>(props: PactListProps<T>): JSX.Element {
  const [local, rest] = splitProps(props, [
    "items",
    "renderItem",
    "onItemClick",
    "selectedId",
    "emptyMessage",
    "loading",
    "class",
    "variant",
    "dividers",
  ]);

  const variant = () => local.variant || "default";

  return (
    <div
      class={clsx(
        listStyles,
        `variant-${variant()}`,
        local.class
      )}
      {...rest}
    >
      <Show when={local.loading}>
        <div class={loadingStateStyles}>
          <For each={[1, 2, 3, 4, 5]}>
            {() => <div class={skeletonStyles} />}
          </For>
        </div>
      </Show>

      <Show when={!local.loading && local.items.length === 0}>
        <div class={emptyStateStyles}>
          {local.emptyMessage || "No items to display"}
        </div>
      </Show>

      <Show when={!local.loading && local.items.length > 0}>
        <For each={local.items}>
          {(item, index) => (
            <div
              class={clsx(
                listItemStyles,
                local.onItemClick && "clickable",
                local.selectedId === item.id && "selected",
                local.dividers && "divider"
              )}
              onClick={() => local.onItemClick?.(item, index())}
              role={local.onItemClick ? "button" : undefined}
              tabindex={local.onItemClick ? 0 : undefined}
            >
              {local.renderItem(item, index())}
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
import { For, JSX, Show, splitProps } from "solid-js";
import { css } from "goober";
import clsx from "clsx";

export interface NavItem {
  id: string;
  label: string;
  icon: JSX.Element;
  badge?: number | string;
}

export interface PactBottomNavigationProps {
  items: NavItem[];
  activeId?: string;
  onItemClick?: (item: NavItem) => void;
  variant?: "default" | "floating" | "compact";
  showLabels?: boolean;
  class?: string;
}

const navigationStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--pact-color-bg-primary);
  border-top: 1px solid var(--pact-color-border-primary);
  width: 100%;
  padding: var(--pact-spacing-sm) var(--pact-spacing-md);
  position: relative;
  z-index: 10;

  &.variant-floating {
    background: var(--pact-glass-bg);
    backdrop-filter: blur(10px);
    border: 1px solid var(--pact-glass-border);
    border-radius: var(--pact-border-radius-lg);
    box-shadow: var(--pact-card-shadow);
    margin: var(--pact-spacing-md);
    width: calc(100% - var(--pact-spacing-md) * 2);
  }

  &.variant-compact {
    padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
  }
`;

const navItemStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--pact-spacing-xs);
  padding: var(--pact-spacing-sm);
  border-radius: var(--pact-border-radius-base);
  cursor: pointer;
  transition: all var(--pact-transition-fast);
  position: relative;
  flex: 1;
  max-width: 100px;
  background: transparent;
  border: none;
  outline: none;

  &:hover {
    background: var(--pact-color-bg-secondary);
  }

  &:active {
    transform: scale(0.95);
  }

  &.active {
    color: var(--pact-color-primary);

    .nav-icon {
      color: var(--pact-color-primary);
    }

    &::after {
      content: "";
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 3px;
      background: var(--pact-color-primary);
      border-radius: 1.5px;
    }
  }

  &.variant-floating.active::after {
    bottom: -4px;
  }

  &.variant-compact {
    padding: var(--pact-spacing-xs);
  }
`;

const navIconStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--pact-color-text-secondary);
  transition: color var(--pact-transition-fast);

  svg {
    width: 100%;
    height: 100%;
  }

  &.variant-compact {
    width: 20px;
    height: 20px;
  }
`;

const navLabelStyles = css`
  font-size: var(--pact-font-size-xs);
  color: var(--pact-color-text-secondary);
  font-weight: 500;
  transition: color var(--pact-transition-fast);

  .active & {
    color: var(--pact-color-primary);
  }
`;

const badgeStyles = css`
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 var(--pact-spacing-xs);
  background: var(--pact-color-error);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`;

export function PactBottomNavigation(props: PactBottomNavigationProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "items",
    "activeId",
    "onItemClick",
    "variant",
    "showLabels",
    "class",
  ]);

  const variant = () => local.variant || "default";
  const showLabels = () => local.showLabels ?? true;

  return (
    <nav
      class={clsx(
        navigationStyles,
        `variant-${variant()}`,
        local.class
      )}
      role="navigation"
      {...rest}
    >
      <For each={local.items}>
        {(item) => (
          <button
            type="button"
            class={clsx(
              navItemStyles,
              local.activeId === item.id && "active",
              `variant-${variant()}`
            )}
            onClick={() => local.onItemClick?.(item)}
            aria-label={item.label}
            aria-current={local.activeId === item.id ? "page" : undefined}
          >
            <div class={clsx(navIconStyles, "nav-icon", `variant-${variant()}`)}>
              {item.icon}
            </div>

            <Show when={showLabels()}>
              <span class={navLabelStyles}>
                {item.label}
              </span>
            </Show>

            <Show when={item.badge}>
              <span class={badgeStyles}>
                {item.badge}
              </span>
            </Show>
          </button>
        )}
      </For>
    </nav>
  );
}
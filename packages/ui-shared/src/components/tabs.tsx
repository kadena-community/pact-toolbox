import {
  Component,
  JSX,
  createSignal,
  createMemo,
  splitProps,
  createContext,
  useContext,
  Show,
} from "solid-js";
import { css } from "goober";
import { clsx } from "clsx";

export type TabsVariant = "default" | "bordered" | "pills";
export type TabsSize = "sm" | "md" | "lg";
export type TabsOrientation = "horizontal" | "vertical";

interface TabsContextValue {
  activeTab: () => string;
  setActiveTab: (tabId: string) => void;
  variant: () => TabsVariant;
  size: () => TabsSize;
  orientation: () => TabsOrientation;
}

const TabsContext = createContext<TabsContextValue>();

interface TabsProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onChange"> {
  variant?: TabsVariant;
  size?: TabsSize;
  orientation?: TabsOrientation;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  children?: JSX.Element;
}

interface TabListProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children?: JSX.Element;
}

interface TabProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  disabled?: boolean;
  children?: JSX.Element;
}

interface TabPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: string;
  children?: JSX.Element;
}

// Base styles
const tabsBase = css`
  display: flex;
  gap: var(--pact-spacing-md);
`;

const tabsHorizontal = css`
  flex-direction: column;
`;

const tabsVertical = css`
  flex-direction: row;
`;

// TabList styles
const tabListBase = css`
  display: flex;
  position: relative;
`;

const tabListHorizontal = css`
  flex-direction: row;
  border-bottom: var(--pact-border-width) solid var(--pact-color-border-primary);
`;

const tabListVertical = css`
  flex-direction: column;
  border-right: var(--pact-border-width) solid var(--pact-color-border-primary);
  min-width: 200px;
`;

// Tab styles
const tabBase = css`
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-secondary);
  transition: all var(--pact-transition-fast) var(--pact-transition-timing);
  position: relative;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;

  &:focus-visible {
    outline: 2px solid var(--pact-focus-color);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    color: var(--pact-color-text-primary);
  }
`;

const tabActive = css`
  color: var(--pact-color-primary) !important;
`;

// Size styles
const tabSizes = {
  sm: css`
    padding: var(--pact-spacing-1_5) var(--pact-spacing-3);
    font-size: var(--pact-font-size-sm);
    min-height: 32px;
  `,
  md: css`
    padding: var(--pact-spacing-2) var(--pact-spacing-4);
    font-size: var(--pact-font-size-base);
    min-height: 40px;
  `,
  lg: css`
    padding: var(--pact-spacing-2_5) var(--pact-spacing-6);
    font-size: var(--pact-font-size-lg);
    min-height: 48px;
  `,
};

// Variant styles
const defaultVariantHorizontal = css`
  &::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--pact-color-primary);
    transform: scaleX(0);
    transition: transform var(--pact-transition-fast) var(--pact-transition-timing);
  }

  &.active::after {
    transform: scaleX(1);
  }
`;

const defaultVariantVertical = css`
  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    right: -1px;
    width: 2px;
    background-color: var(--pact-color-primary);
    transform: scaleY(0);
    transition: transform var(--pact-transition-fast) var(--pact-transition-timing);
  }

  &.active::after {
    transform: scaleY(1);
  }
`;

const borderedVariant = css`
  border: var(--pact-border-width) solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-base);
  margin-right: var(--pact-spacing-1);

  &.active {
    background-color: var(--pact-color-bg-secondary);
    border-color: var(--pact-color-primary);
  }

  &:hover:not(:disabled) {
    border-color: var(--pact-color-border-secondary);
  }
`;

const pillsVariant = css`
  border-radius: var(--pact-border-radius-full);
  margin-right: var(--pact-spacing-1);

  &.active {
    background-color: var(--pact-color-primary);
    color: var(--pact-color-text-inverse) !important;
  }

  &:hover:not(:disabled) {
    background-color: var(--pact-color-bg-secondary);
  }

  &.active:hover:not(:disabled) {
    background-color: var(--pact-color-primary-hover);
  }
`;

// TabPanel styles
const tabPanelBase = css`
  flex: 1;
  outline: none;

  &:focus-visible {
    outline: 2px solid var(--pact-focus-color);
    outline-offset: 2px;
    border-radius: var(--pact-border-radius-base);
  }
`;

export const PactTabs: Component<TabsProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    "variant",
    "size",
    "orientation",
    "defaultValue",
    "value",
    "onChange",
    "children",
    "class",
  ]);

  const variant = () => local.variant || "default";
  const size = () => local.size || "md";
  const orientation = () => local.orientation || "horizontal";

  const [internalValue, setInternalValue] = createSignal(local.defaultValue || "");

  const activeTab = createMemo(() => {
    return local.value !== undefined ? local.value : internalValue();
  });

  const setActiveTab = (tabId: string) => {
    if (local.value === undefined) {
      setInternalValue(tabId);
    }
    local.onChange?.(tabId);
  };

  const contextValue: TabsContextValue = {
    activeTab,
    setActiveTab,
    variant,
    size,
    orientation,
  };

  const tabsClass = createMemo(() =>
    clsx(tabsBase, orientation() === "horizontal" ? tabsHorizontal : tabsVertical, local.class),
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div {...divProps} class={tabsClass()}>
        {local.children}
      </div>
    </TabsContext.Provider>
  );
};

export const PactTabList: Component<TabListProps> = (props) => {
  const [local, divProps] = splitProps(props, ["children", "class"]);
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("TabList must be used within Tabs");
  }

  const tabListClass = createMemo(() =>
    clsx(tabListBase, context.orientation() === "horizontal" ? tabListHorizontal : tabListVertical, local.class),
  );

  return (
    <div {...divProps} class={tabListClass()} role="tablist">
      {local.children}
    </div>
  );
};

export const PactTab: Component<TabProps> = (props) => {
  const [local, buttonProps] = splitProps(props, ["value", "disabled", "children", "class"]);

  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("Tab must be used within Tabs");
  }

  const isActive = createMemo(() => context.activeTab() === local.value);

  const handleClick = (e: MouseEvent) => {
    if (local.disabled) {
      e.preventDefault();
      return;
    }

    context.setActiveTab(local.value);

    const handler = buttonProps.onClick;
    if (typeof handler === "function") {
      handler(e as any);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (local.disabled) return;

    // Handle arrow key navigation
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();

      const tablist = (e.target as HTMLElement).closest('[role="tablist"]');
      if (!tablist) return;

      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const currentIndex = tabs.indexOf(e.target as HTMLElement);

      let nextIndex: number;
      if (
        (context.orientation() === "horizontal" && e.key === "ArrowRight") ||
        (context.orientation() === "vertical" && e.key === "ArrowDown")
      ) {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (
        (context.orientation() === "horizontal" && e.key === "ArrowLeft") ||
        (context.orientation() === "vertical" && e.key === "ArrowUp")
      ) {
        nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      } else {
        return;
      }

      const nextTab = tabs[nextIndex] as HTMLElement;
      if (nextTab && !nextTab.hasAttribute("disabled")) {
        nextTab.focus();
        const tabValue = nextTab.getAttribute("data-value");
        if (tabValue) {
          context.setActiveTab(tabValue);
        }
      }
    }

    const handler = buttonProps.onKeyDown;
    if (typeof handler === "function") {
      handler(e as any);
    }
  };

  const getVariantClass = () => {
    const variant = context.variant();
    const orientation = context.orientation();

    if (variant === "default") {
      return orientation === "horizontal" ? defaultVariantHorizontal : defaultVariantVertical;
    } else if (variant === "bordered") {
      return borderedVariant;
    } else if (variant === "pills") {
      return pillsVariant;
    }
    return "";
  };

  const tabClass = createMemo(() =>
    clsx(
      tabBase,
      tabSizes[context.size()],
      getVariantClass(),
      isActive() && (context.variant() !== "default" ? "active" : tabActive),
      local.class,
    ),
  );

  return (
    <button
      {...buttonProps}
      class={tabClass()}
      role="tab"
      disabled={local.disabled}
      aria-selected={isActive()}
      aria-controls={`tabpanel-${local.value}`}
      data-value={local.value}
      tabIndex={isActive() ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {local.children}
    </button>
  );
};

export const PactTabPanel: Component<TabPanelProps> = (props) => {
  const [local, divProps] = splitProps(props, ["value", "children", "class"]);

  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("TabPanel must be used within Tabs");
  }

  const isActive = createMemo(() => context.activeTab() === local.value);

  const tabPanelClass = createMemo(() => clsx(tabPanelBase, local.class));

  return (
    <Show when={isActive()}>
      <div
        {...divProps}
        class={tabPanelClass()}
        role="tabpanel"
        id={`tabpanel-${local.value}`}
        aria-labelledby={`tab-${local.value}`}
        tabIndex={0}
      >
        {local.children}
      </div>
    </Show>
  );
};

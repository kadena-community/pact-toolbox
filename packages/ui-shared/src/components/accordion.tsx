import { Component, JSX, createSignal, createMemo, splitProps, createContext, useContext, createEffect } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';

export type AccordionType = "single" | "multiple";

interface AccordionContextValue {
  openItems: () => Set<string>;
  toggleItem: (itemId: string) => void;
  type: () => AccordionType;
}

const AccordionContext = createContext<AccordionContextValue>();

// Item context for sharing value between trigger and content
interface ItemContextValue {
  value: string;
  isOpen: () => boolean;
}

const ItemContext = createContext<ItemContextValue>();

interface AccordionProps {
  type?: AccordionType;
  defaultValue?: string | string[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  collapsible?: boolean;
  children?: JSX.Element;
  class?: string;
  classList?: { [key: string]: boolean | undefined };
  style?: JSX.CSSProperties | string;
}

interface AccordionItemProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
  children?: JSX.Element;
}

interface AccordionTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: JSX.Element;
}

interface AccordionContentProps extends JSX.HTMLAttributes<HTMLDivElement> {
  children?: JSX.Element;
}

// Base accordion styles
const accordionBase = css`
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-lg);
  background-color: var(--pact-color-bg-primary);
  overflow: hidden;
`;

// Accordion item styles
const accordionItemBase = css`
  border-bottom: 1px solid var(--pact-color-border-primary);

  &:last-child {
    border-bottom: none;
  }

  &[data-state="open"] {
    background-color: var(--pact-color-bg-secondary);
  }
`;

// Accordion trigger styles
const accordionTriggerBase = css`
  width: 100%;
  background: transparent;
  border: none;
  padding: 1rem;
  font-family: inherit;
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-primary);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;

  &:hover:not(:disabled) {
    background-color: var(--pact-color-bg-secondary);
  }

  &:focus-visible {
    outline: 2px solid var(--pact-focus-color);
    outline-offset: -2px;
  }

  &:disabled {
    opacity: var(--pact-disabled-opacity);
    cursor: not-allowed;
  }
`;

// Accordion content styles
const accordionContentBase = css`
  overflow: hidden;
  transition: height 250ms cubic-bezier(0.4, 0, 0.2, 1);
`;

const accordionContentInner = css`
  padding: 0 1rem 1rem;
  color: var(--pact-color-text-secondary);
  line-height: 1.6;
`;

// Icon styles
const iconBase = css`
  width: 16px;
  height: 16px;
  transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  color: var(--pact-color-text-secondary);

  &[data-state="open"] {
    transform: rotate(180deg);
  }
`;

// Chevron down icon component
const ChevronDownIcon = () => (
  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
  </svg>
);

export const PactAccordion: Component<AccordionProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'type',
    'defaultValue',
    'value',
    'onChange',
    'collapsible',
    'children',
    'class'
  ]);

  const type = () => local.type || 'single';
  const collapsible = () => local.collapsible !== false; // Default to true

  // Initialize open items based on defaultValue
  const [internalOpenItems, setInternalOpenItems] = createSignal<Set<string>>(
    new Set(
      Array.isArray(local.defaultValue)
        ? local.defaultValue
        : local.defaultValue ? [local.defaultValue] : []
    )
  );

  const openItems = createMemo(() => {
    if (local.value !== undefined) {
      return new Set(
        Array.isArray(local.value)
          ? local.value
          : local.value ? [local.value] : []
      );
    }
    return internalOpenItems();
  });

  const toggleItem = (itemId: string) => {
    const currentOpen = openItems();
    const newOpenItems = new Set(currentOpen);

    if (type() === 'single') {
      if (newOpenItems.has(itemId)) {
        if (collapsible()) {
          newOpenItems.clear();
        }
      } else {
        newOpenItems.clear();
        newOpenItems.add(itemId);
      }
    } else {
      // multiple type
      if (newOpenItems.has(itemId)) {
        newOpenItems.delete(itemId);
      } else {
        newOpenItems.add(itemId);
      }
    }

    if (local.value === undefined) {
      setInternalOpenItems(newOpenItems);
    }

    // Call onChange callback
    const newValue = type() === 'single'
      ? (newOpenItems.size > 0 ? Array.from(newOpenItems)[0] : '')
      : Array.from(newOpenItems);

    local.onChange?.(newValue);
  };

  const contextValue: AccordionContextValue = {
    openItems,
    toggleItem,
    type
  };

  const accordionClass = createMemo(() =>
    clsx(
      accordionBase,
      local.class
    )
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <div {...divProps} class={accordionClass()}>
        {local.children}
      </div>
    </AccordionContext.Provider>
  );
};

export const PactAccordionItem: Component<AccordionItemProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'value',
    'disabled',
    'children',
    'class'
  ]);

  const context = useContext(AccordionContext);

  if (!context) {
    throw new Error('AccordionItem must be used within Accordion');
  }

  const isOpen = createMemo(() => context.openItems().has(local.value));

  const accordionItemClass = createMemo(() =>
    clsx(
      accordionItemBase,
      local.class
    )
  );

  // Create item context value
  const itemContextValue: ItemContextValue = {
    value: local.value,
    isOpen
  };

  return (
    <ItemContext.Provider value={itemContextValue}>
      <div {...divProps} class={accordionItemClass()} data-state={isOpen() ? "open" : "closed"} data-value={local.value}>
        {local.children}
      </div>
    </ItemContext.Provider>
  );
};

export const PactAccordionTrigger: Component<AccordionTriggerProps> = (props) => {
  const [local, buttonProps] = splitProps(props, [
    'children',
    'class'
  ]);

  const accordionContext = useContext(AccordionContext);
  const itemContext = useContext(ItemContext);

  if (!accordionContext) {
    throw new Error('AccordionTrigger must be used within Accordion');
  }

  if (!itemContext) {
    throw new Error('AccordionTrigger must be used within AccordionItem');
  }

  const handleClick = (e: MouseEvent) => {
    accordionContext.toggleItem(itemContext.value);

    const handler = buttonProps.onClick;
    if (typeof handler === 'function') {
      handler(e as any);
    }
  };

  const accordionTriggerClass = createMemo(() =>
    clsx(
      accordionTriggerBase,
      local.class
    )
  );

  return (
    <button
      {...buttonProps}
      class={accordionTriggerClass()}
      type="button"
      aria-expanded={itemContext.isOpen()}
      data-state={itemContext.isOpen() ? "open" : "closed"}
      onClick={handleClick}
    >
      <span>{local.children}</span>
      <span class={iconBase} data-state={itemContext.isOpen() ? "open" : "closed"}>
        <ChevronDownIcon />
      </span>
    </button>
  );
};

export const PactAccordionContent: Component<AccordionContentProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'children',
    'class'
  ]);

  const itemContext = useContext(ItemContext);

  if (!itemContext) {
    throw new Error('AccordionContent must be used within AccordionItem');
  }

  let contentRef: HTMLDivElement | undefined;
  const [height, setHeight] = createSignal('0px');

  createEffect(() => {
    if (contentRef) {
      if (itemContext.isOpen()) {
        const scrollHeight = contentRef.scrollHeight;
        setHeight(`${scrollHeight}px`);
      } else {
        setHeight('0px');
      }
    }
  });

  const accordionContentClass = createMemo(() =>
    clsx(
      accordionContentBase,
      local.class
    )
  );

  return (
    <div
      {...divProps}
      ref={(el) => contentRef = el}
      class={accordionContentClass()}
      style={{
        height: height(),
      }}
      data-state={itemContext.isOpen() ? "open" : "closed"}
    >
      <div class={accordionContentInner}>
        {local.children}
      </div>
    </div>
  );
};
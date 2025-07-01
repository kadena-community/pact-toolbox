import { Component, JSX, createSignal, onMount, onCleanup, children, Show, createEffect } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';
import { Portal } from 'solid-js/web';

export type DropdownPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';

interface DropdownProps {
  target: JSX.Element;
  children: JSX.Element;
  placement?: DropdownPlacement;
  offset?: number;
  disabled?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  class?: string;
}

// Base dropdown styles
const dropdownContainer = css`
  position: fixed;
  z-index: var(--pact-z-index-dropdown);
  background-color: var(--pact-color-bg-primary);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  box-shadow: var(--pact-shadow-lg);
  padding: var(--pact-spacing-1);
  min-width: 160px;
  max-width: 280px;
  animation: dropdown-enter 0.15s ease-out;

  @keyframes dropdown-enter {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const triggerWrapper = css`
  display: inline-block;
  position: relative;
`;

interface Position {
  top: number;
  left: number;
  actualPlacement: DropdownPlacement;
  shouldHide: boolean;
}

const calculatePosition = (
  triggerRect: DOMRect,
  dropdownRect: DOMRect,
  preferredPlacement: DropdownPlacement,
  offset: number
): Position => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;

  // Check if trigger is too close to viewport edges (hide dropdown if so)
  if (triggerRect.left < margin || triggerRect.right > viewportWidth - margin ||
      triggerRect.top < margin || triggerRect.bottom > viewportHeight - margin) {
    return {
      top: 0,
      left: 0,
      actualPlacement: preferredPlacement,
      shouldHide: true
    };
  }

  // Calculate available space in each direction
  const spaceBottom = viewportHeight - triggerRect.bottom - margin;
  const spaceTop = triggerRect.top - margin;
  const spaceLeft = triggerRect.left - margin;
  const spaceRight = viewportWidth - triggerRect.right - margin;

  // Determine best placement based on available space
  const placements: { placement: DropdownPlacement; space: number; fits: boolean }[] = [
    {
      placement: 'bottom-start',
      space: spaceBottom,
      fits: spaceBottom >= dropdownRect.height + offset
    },
    {
      placement: 'top-start',
      space: spaceTop,
      fits: spaceTop >= dropdownRect.height + offset
    },
    {
      placement: 'right-start',
      space: spaceRight,
      fits: spaceRight >= dropdownRect.width + offset
    },
    {
      placement: 'left-start',
      space: spaceLeft,
      fits: spaceLeft >= dropdownRect.width + offset
    }
  ];

  // Try preferred placement first, then find best alternative
  let actualPlacement = preferredPlacement;
  const preferredBase = preferredPlacement.split('-')[0] as 'bottom' | 'top' | 'left' | 'right';
  const preferredOption = placements.find(p => p.placement.startsWith(preferredBase));

  if (!preferredOption?.fits) {
    // Find best fitting placement
    const fittingPlacements = placements.filter(p => p.fits);
    if (fittingPlacements.length > 0) {
      // Choose the one with most space
      const bestPlacement = fittingPlacements.sort((a, b) => b.space - a.space)[0].placement;
      // Preserve the alignment (start/end) if possible
      const alignment = preferredPlacement.split('-')[1] || 'start';
      actualPlacement = `${bestPlacement.split('-')[0]}-${alignment}` as DropdownPlacement;
    } else {
      // No good placement available, hide the dropdown
      return {
        top: 0,
        left: 0,
        actualPlacement: preferredPlacement,
        shouldHide: true
      };
    }
  }

  let top = 0;
  let left = 0;

  // Calculate position based on actual placement
  switch (actualPlacement) {
    case 'bottom-start':
      top = triggerRect.bottom + offset;
      left = triggerRect.left;
      break;
    case 'bottom-end':
      top = triggerRect.bottom + offset;
      left = triggerRect.right - dropdownRect.width;
      break;
    case 'top-start':
      top = triggerRect.top - dropdownRect.height - offset;
      left = triggerRect.left;
      break;
    case 'top-end':
      top = triggerRect.top - dropdownRect.height - offset;
      left = triggerRect.right - dropdownRect.width;
      break;
    case 'left-start':
      top = triggerRect.top;
      left = triggerRect.left - dropdownRect.width - offset;
      break;
    case 'left-end':
      top = triggerRect.bottom - dropdownRect.height;
      left = triggerRect.left - dropdownRect.width - offset;
      break;
    case 'right-start':
      top = triggerRect.top;
      left = triggerRect.right + offset;
      break;
    case 'right-end':
      top = triggerRect.bottom - dropdownRect.height;
      left = triggerRect.right + offset;
      break;
  }

  // Adjust for viewport boundaries (fine-tuning)
  if (left < margin) {
    left = margin;
  } else if (left + dropdownRect.width > viewportWidth - margin) {
    left = viewportWidth - dropdownRect.width - margin;
  }

  if (top < margin) {
    top = margin;
  } else if (top + dropdownRect.height > viewportHeight - margin) {
    top = viewportHeight - dropdownRect.height - margin;
  }

  return { top, left, actualPlacement, shouldHide: false };
};

export const PactDropdown: Component<DropdownProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [position, setPosition] = createSignal<Position>({ top: 0, left: 0, actualPlacement: 'bottom-start', shouldHide: false });
  const [triggerElement, setTriggerElement] = createSignal<HTMLElement>();
  const [dropdownElement, setDropdownElement] = createSignal<HTMLElement>();

  const placement = () => props.placement || 'bottom-start';
  const offset = () => props.offset || 4;
  const closeOnClickOutside = () => props.closeOnClickOutside ?? true;
  const closeOnEscape = () => props.closeOnEscape ?? true;

  const resolvedTarget = children(() => props.target);

  const updatePosition = () => {
    const trigger = triggerElement();
    const dropdown = dropdownElement();
    if (!trigger || !dropdown) return;

    const triggerRect = trigger.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();

    const newPosition = calculatePosition(triggerRect, dropdownRect, placement(), offset());
    setPosition(newPosition);
  };

  const handleTriggerClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    if (props.disabled) return;

    if (!isOpen()) {
      setIsOpen(true);
      // Use requestAnimationFrame to ensure the dropdown is rendered before calculating position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updatePosition();
          // Focus first item after opening
          const dropdown = dropdownElement();
          if (dropdown) {
            const firstItem = dropdown.querySelector('button:not(:disabled)') as HTMLElement;
            if (firstItem) {
              firstItem.focus();
            }
          }
        });
      });
    } else {
      setIsOpen(false);
    }
  };

  const handleTriggerKeyDown = (e: KeyboardEvent) => {
    if (props.disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen()) {
          setIsOpen(true);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              updatePosition();
              // Focus first item after opening
              const dropdown = dropdownElement();
              if (dropdown) {
                const firstItem = dropdown.querySelector('button:not(:disabled)') as HTMLElement;
                if (firstItem) {
                  firstItem.focus();
                }
              }
            });
          });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen()) {
          setIsOpen(true);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              updatePosition();
              // Focus last item when opening with ArrowUp
              const dropdown = dropdownElement();
              if (dropdown) {
                const items = dropdown.querySelectorAll('button:not(:disabled)');
                const lastItem = items[items.length - 1] as HTMLElement;
                if (lastItem) {
                  lastItem.focus();
                }
              }
            });
          });
        }
        break;
    }
  };

  const handleClickOutside = (e: Event) => {
    if (!closeOnClickOutside()) return;

    const trigger = triggerElement();
    const dropdown = dropdownElement();
    const target = e.target as Node;

    if (trigger?.contains(target) || dropdown?.contains(target)) {
      return;
    }

    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen()) return;

    switch (e.key) {
      case 'Escape':
        if (closeOnEscape()) {
          e.preventDefault();
          setIsOpen(false);
          triggerElement()?.focus();
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        const dropdown = dropdownElement();
        if (dropdown) {
          const items = dropdown.querySelectorAll('button:not(:disabled)');
          if (items.length > 0) {
            const currentIndex = Array.from(items).findIndex(item => item === document.activeElement);
            let nextIndex;

            if (e.key === 'ArrowDown') {
              nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
            } else {
              nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            }

            (items[nextIndex] as HTMLElement).focus();
          }
        }
        break;
      case 'Tab':
        // Allow tabbing out of dropdown to close it
        setTimeout(() => {
          const dropdown = dropdownElement();
          const trigger = triggerElement();
          if (dropdown && trigger && !dropdown.contains(document.activeElement) && document.activeElement !== trigger) {
            setIsOpen(false);
          }
        }, 0);
        break;
    }
  };

  const handleResize = () => {
    if (isOpen()) {
      updatePosition();
    }
  };

  const handleCloseDropdown = () => {
    setIsOpen(false);
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('closeDropdown', handleCloseDropdown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('closeDropdown', handleCloseDropdown);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleResize);
  });

  // Update position when dropdown opens or placement changes
  createEffect(() => {
    if (isOpen()) {
      updatePosition();
    }
  });

  return (
    <>
      <span
        ref={setTriggerElement}
        class={triggerWrapper}
        tabIndex={0}
        role="button"
        aria-haspopup="true"
        aria-expanded={isOpen()}
        aria-controls={isOpen() ? "dropdown-menu" : undefined}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        {resolvedTarget()}
      </span>

      <Show when={isOpen() && !position().shouldHide}>
        <Portal>
          <div
            ref={setDropdownElement}
            id="dropdown-menu"
            role="menu"
            aria-orientation="vertical"
            class={clsx(dropdownContainer, props.class)}
            style={{
              top: `${position().top}px`,
              left: `${position().left}px`,
            }}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </>
  );
};

// Dropdown menu item component for better UX
export const PactDropdownItem: Component<{
  children: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  class?: string;
}> = (props) => {
  const itemStyle = css`
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--pact-spacing-2) var(--pact-spacing-3);
    border: none;
    background: none;
    color: var(--pact-color-text-primary);
    font-size: var(--pact-font-size-sm);
    font-weight: var(--pact-font-weight-medium);
    font-family: inherit;
    cursor: pointer;
    border-radius: var(--pact-border-radius-sm);
    transition: all var(--pact-transition-fast) var(--pact-transition-timing);
    text-align: left;

    &:hover:not(:disabled) {
      background-color: var(--pact-color-bg-secondary);
      color: var(--pact-color-text-primary);
    }

    &:focus:not(:disabled) {
      background-color: var(--pact-color-bg-secondary);
      outline: 2px solid var(--pact-color-border-focus);
      outline-offset: -2px;
    }

    &:focus-visible:not(:disabled) {
      background-color: var(--pact-color-bg-secondary);
      outline: 2px solid var(--pact-color-border-focus);
      outline-offset: -2px;
    }

    &:active:not(:disabled) {
      background-color: var(--pact-color-bg-tertiary);
      transform: scale(var(--pact-active-scale));
    }

    &:disabled {
      opacity: var(--pact-disabled-opacity);
      cursor: not-allowed;
      color: var(--pact-color-text-tertiary);
    }

    &.danger {
      color: var(--pact-color-error);

      &:hover:not(:disabled) {
        background-color: var(--pact-color-error-lighter);
        color: var(--pact-color-error);
      }

      &:focus:not(:disabled) {
        background-color: var(--pact-color-error-lighter);
        outline: 2px solid var(--pact-color-error);
        outline-offset: -2px;
      }

      &:focus-visible:not(:disabled) {
        background-color: var(--pact-color-error-lighter);
        outline: 2px solid var(--pact-color-error);
        outline-offset: -2px;
      }

      &:active:not(:disabled) {
        background-color: var(--pact-color-error-lighter);
        transform: scale(var(--pact-active-scale));
      }
    }
  `;

  const handleClick = (e: Event) => {
    e.stopPropagation();
    if (!props.disabled && props.onClick) {
      props.onClick();
      // Close the dropdown after clicking an item
      const dropdownEvent = new CustomEvent('closeDropdown');
      document.dispatchEvent(dropdownEvent);
    }
  };

  return (
    <button
      class={clsx(itemStyle, props.danger && 'danger', props.class)}
      role="menuitem"
      onClick={handleClick}
      disabled={props.disabled}
      type="button"
    >
      {props.children}
    </button>
  );
};

// Dropdown divider component
export const PactDropdownDivider: Component<{ class?: string }> = (props) => {
  const dividerStyle = css`
    height: 1px;
    background-color: var(--pact-color-border-primary);
    margin: var(--pact-spacing-1) 0;
  `;

  return <div class={clsx(dividerStyle, props.class)} />;
};
import { Component, JSX, createSignal, onMount, onCleanup, children, Show, createEffect } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';
import { Portal } from 'solid-js/web';

export type PopoverPlacement = 'bottom' | 'top' | 'left' | 'right' | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
export type PopoverTrigger = 'click' | 'hover' | 'focus' | 'manual';

interface PopoverProps {
  target: JSX.Element;
  children: JSX.Element;
  placement?: PopoverPlacement;
  trigger?: PopoverTrigger;
  offset?: number;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  showArrow?: boolean;
  class?: string;
}

// Base popover styles
const popoverContainer = css`
  position: fixed;
  z-index: var(--pact-z-index-popover);
  background-color: var(--pact-color-bg-primary);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-md);
  box-shadow: var(--pact-shadow-lg);
  padding: var(--pact-spacing-3);
  max-width: 320px;
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-normal);
  color: var(--pact-color-text-primary);
  animation: popover-enter 0.15s ease-out;

  @keyframes popover-enter {
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

const popoverArrow = css`
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;

  &.bottom {
    border-width: 0 6px 6px 6px;
    border-color: transparent transparent var(--pact-color-bg-primary) transparent;
    filter: drop-shadow(0 -1px 0 var(--pact-color-border-primary));
  }

  &.top {
    border-width: 6px 6px 0 6px;
    border-color: var(--pact-color-bg-primary) transparent transparent transparent;
    filter: drop-shadow(0 1px 0 var(--pact-color-border-primary));
  }

  &.left {
    border-width: 6px 0 6px 6px;
    border-color: transparent transparent transparent var(--pact-color-bg-primary);
    filter: drop-shadow(1px 0 0 var(--pact-color-border-primary));
  }

  &.right {
    border-width: 6px 6px 6px 0;
    border-color: transparent var(--pact-color-bg-primary) transparent transparent;
    filter: drop-shadow(-1px 0 0 var(--pact-color-border-primary));
  }
`;

const triggerWrapper = css`
  display: inline-block;
  position: relative;
`;

interface Position {
  top: number;
  left: number;
  actualPlacement: PopoverPlacement;
  shouldHide: boolean;
  arrowPosition?: {
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
  };
}

const calculatePosition = (
  triggerRect: DOMRect,
  popoverRect: DOMRect,
  preferredPlacement: PopoverPlacement,
  offset: number,
  showArrow: boolean
): Position => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const arrowSize = showArrow ? 8 : 0;
  const margin = 8;

  // Check if trigger is too close to viewport edges (hide popover if so)
  // const minSpace = 100; // Minimum space needed to show popover
  if (triggerRect.left < margin || triggerRect.right > viewportWidth - margin ||
      triggerRect.top < margin || triggerRect.bottom > viewportHeight - margin) {
    return {
      top: 0,
      left: 0,
      actualPlacement: preferredPlacement,
      shouldHide: true,
      arrowPosition: {}
    };
  }

  // Calculate available space in each direction
  const spaceBottom = viewportHeight - triggerRect.bottom - margin;
  const spaceTop = triggerRect.top - margin;
  const spaceLeft = triggerRect.left - margin;
  const spaceRight = viewportWidth - triggerRect.right - margin;

  // Determine best placement based on available space
  const placements: { placement: PopoverPlacement; space: number; fits: boolean }[] = [
    {
      placement: 'bottom',
      space: spaceBottom,
      fits: spaceBottom >= popoverRect.height + offset + arrowSize
    },
    {
      placement: 'top',
      space: spaceTop,
      fits: spaceTop >= popoverRect.height + offset + arrowSize
    },
    {
      placement: 'right',
      space: spaceRight,
      fits: spaceRight >= popoverRect.width + offset + arrowSize
    },
    {
      placement: 'left',
      space: spaceLeft,
      fits: spaceLeft >= popoverRect.width + offset + arrowSize
    }
  ];

  // Try preferred placement first, then find best alternative
  let actualPlacement = preferredPlacement;
  const preferredOption = placements.find(p => p.placement === preferredPlacement.split('-')[0]);

  if (!preferredOption?.fits) {
    // Find best fitting placement
    const fittingPlacements = placements.filter(p => p.fits);
    if (fittingPlacements.length > 0) {
      // Choose the one with most space
      actualPlacement = fittingPlacements.sort((a, b) => b.space - a.space)[0].placement;
    } else {
      // No good placement available, hide the popover
      return {
        top: 0,
        left: 0,
        actualPlacement: preferredPlacement,
        shouldHide: true,
        arrowPosition: {}
      };
    }
  }

  let top = 0;
  let left = 0;
  let arrowPosition: Position['arrowPosition'] = {};

  // Calculate position based on actual placement
  switch (actualPlacement) {
    case 'bottom':
      top = triggerRect.bottom + offset + arrowSize;
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
      break;
    case 'top':
      top = triggerRect.top - popoverRect.height - offset - arrowSize;
      left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
      break;
    case 'left':
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
      left = triggerRect.left - popoverRect.width - offset - arrowSize;
      break;
    case 'right':
      top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
      left = triggerRect.right + offset + arrowSize;
      break;
  }

  // Adjust for viewport boundaries (fine-tuning)
  if (left < margin) {
    left = margin;
  } else if (left + popoverRect.width > viewportWidth - margin) {
    left = viewportWidth - popoverRect.width - margin;
  }

  if (top < margin) {
    top = margin;
  } else if (top + popoverRect.height > viewportHeight - margin) {
    top = viewportHeight - popoverRect.height - margin;
  }

  // Calculate arrow position dynamically based on trigger center relative to final popover position
  if (showArrow) {
    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const triggerCenterY = triggerRect.top + triggerRect.height / 2;

    if (actualPlacement === 'bottom') {
      const arrowX = Math.max(16, Math.min(triggerCenterX - left, popoverRect.width - 16));
      arrowPosition = { top: '-6px', left: `${arrowX}px` };
    } else if (actualPlacement === 'top') {
      const arrowX = Math.max(16, Math.min(triggerCenterX - left, popoverRect.width - 16));
      arrowPosition = { bottom: '-6px', left: `${arrowX}px` };
    } else if (actualPlacement === 'left') {
      const arrowY = Math.max(16, Math.min(triggerCenterY - top, popoverRect.height - 16));
      arrowPosition = { right: '-6px', top: `${arrowY}px` };
    } else if (actualPlacement === 'right') {
      const arrowY = Math.max(16, Math.min(triggerCenterY - top, popoverRect.height - 16));
      arrowPosition = { left: '-6px', top: `${arrowY}px` };
    }
  }

  return { top, left, actualPlacement, shouldHide: false, arrowPosition };
};

export const PactPopover: Component<PopoverProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(props.open ?? false);
  const [position, setPosition] = createSignal<Position>({ top: 0, left: 0, actualPlacement: 'bottom', shouldHide: false });
  const [triggerElement, setTriggerElement] = createSignal<HTMLElement>();
  const [popoverElement, setPopoverElement] = createSignal<HTMLElement>();
  const [hoverTimeout, setHoverTimeout] = createSignal<number>();

  const placement = () => props.placement || 'bottom';
  const trigger = () => props.trigger || 'click';
  const offset = () => props.offset || 8;
  const closeOnClickOutside = () => props.closeOnClickOutside ?? true;
  const closeOnEscape = () => props.closeOnEscape ?? true;
  const showArrow = () => props.showArrow ?? true;

  const resolvedTarget = children(() => props.target);

  const updatePosition = () => {
    const triggerEl = triggerElement();
    const popoverEl = popoverElement();
    if (!triggerEl || !popoverEl) return;

    const triggerRect = triggerEl.getBoundingClientRect();
    const popoverRect = popoverEl.getBoundingClientRect();

    const newPosition = calculatePosition(triggerRect, popoverRect, placement(), offset(), showArrow());
    setPosition(newPosition);
  };

  const openPopover = () => {
    if (props.disabled) return;
    setIsOpen(true);
    props.onOpenChange?.(true);
    // Use requestAnimationFrame to ensure the popover is rendered before calculating position
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updatePosition();
        // Focus first focusable element after opening
        if (trigger() === 'click' || trigger() === 'focus') {
          const popover = popoverElement();
          if (popover) {
            const firstFocusable = popover.querySelector(
              'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)'
            ) as HTMLElement;
            if (firstFocusable) {
              firstFocusable.focus();
            }
          }
        }
      });
    });
  };

  const closePopover = () => {
    setIsOpen(false);
    props.onOpenChange?.(false);
  };

  const handleTriggerClick = (e: Event) => {
    if (trigger() !== 'click') return;
    e.preventDefault();
    e.stopPropagation();

    if (isOpen()) {
      closePopover();
    } else {
      openPopover();
    }
  };

  const handleTriggerMouseEnter = () => {
    if (trigger() !== 'hover') return;

    const timeout = hoverTimeout();
    if (timeout) {
      clearTimeout(timeout);
      setHoverTimeout(undefined);
    }

    openPopover();
  };

  const handleTriggerMouseLeave = () => {
    if (trigger() !== 'hover') return;

    const timeout = window.setTimeout(() => {
      closePopover();
      setHoverTimeout(undefined);
    }, 150);

    setHoverTimeout(timeout);
  };

  const handlePopoverMouseEnter = () => {
    if (trigger() !== 'hover') return;

    const timeout = hoverTimeout();
    if (timeout) {
      clearTimeout(timeout);
      setHoverTimeout(undefined);
    }
  };

  const handlePopoverMouseLeave = () => {
    if (trigger() !== 'hover') return;

    const timeout = window.setTimeout(() => {
      closePopover();
      setHoverTimeout(undefined);
    }, 150);

    setHoverTimeout(timeout);
  };

  const handleTriggerFocus = () => {
    if (trigger() !== 'focus') return;
    openPopover();
  };

  const handleTriggerBlur = () => {
    if (trigger() !== 'focus') return;
    closePopover();
  };

  const handleClickOutside = (e: Event) => {
    if (!closeOnClickOutside() || trigger() === 'hover') return;

    const triggerEl = triggerElement();
    const popoverEl = popoverElement();
    const target = e.target as Node;

    if (triggerEl?.contains(target) || popoverEl?.contains(target)) {
      return;
    }

    closePopover();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen()) return;

    switch (e.key) {
      case 'Escape':
        if (closeOnEscape()) {
          e.preventDefault();
          closePopover();
          triggerElement()?.focus();
        }
        break;
      case 'Tab':
        // Handle tab navigation within popover
        const popover = popoverElement();
        if (popover) {
          const focusableElements = popover.querySelectorAll(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"]):not(:disabled)'
          );

          if (focusableElements.length === 0) {
            // No focusable elements, close popover and return focus to trigger
            e.preventDefault();
            closePopover();
            triggerElement()?.focus();
            return;
          }

          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            // Shift+Tab: if on first element, close popover
            if (document.activeElement === firstElement) {
              e.preventDefault();
              closePopover();
              triggerElement()?.focus();
            }
          } else {
            // Tab: if on last element, close popover
            if (document.activeElement === lastElement) {
              e.preventDefault();
              closePopover();
              triggerElement()?.focus();
            }
          }
        }
        break;
    }
  };

  const handleResize = () => {
    if (isOpen()) {
      updatePosition();
    }
  };

  // Handle controlled open state
  createEffect(() => {
    if (props.open !== undefined) {
      setIsOpen(props.open);
      if (props.open) {
        setTimeout(updatePosition, 0);
      }
    }
  });

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleResize);

    const timeout = hoverTimeout();
    if (timeout) {
      clearTimeout(timeout);
    }
  });

  // Update position when popover opens or placement changes
  createEffect(() => {
    if (isOpen()) {
      updatePosition();
    }
  });

  const getArrowClass = () => {
    const actualPlacement = position().actualPlacement;
    if (actualPlacement.includes('top')) return 'top';
    if (actualPlacement.includes('bottom')) return 'bottom';
    if (actualPlacement.includes('left')) return 'left';
    if (actualPlacement.includes('right')) return 'right';
    return actualPlacement;
  };

  return (
    <>
      <span
        ref={setTriggerElement}
        class={triggerWrapper}
        tabIndex={trigger() === 'focus' || trigger() === 'click' ? 0 : undefined}
        role={trigger() === 'click' ? 'button' : undefined}
        aria-haspopup="dialog"
        aria-expanded={isOpen()}
        aria-controls={isOpen() ? "popover-content" : undefined}
        onClick={handleTriggerClick}
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleTriggerMouseLeave}
        onFocus={handleTriggerFocus}
        onBlur={handleTriggerBlur}
      >
        {resolvedTarget()}
      </span>

      <Show when={isOpen() && !position().shouldHide}>
        <Portal>
          <div
            ref={setPopoverElement}
            id="popover-content"
            role="dialog"
            aria-modal="false"
            class={clsx(popoverContainer, props.class)}
            style={{
              top: `${position().top}px`,
              left: `${position().left}px`,
            }}
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handlePopoverMouseLeave}
          >
            {props.children}

            <Show when={showArrow()}>
              <div
                class={clsx(popoverArrow, getArrowClass())}
                style={{
                  ...position().arrowPosition,
                }}
              />
            </Show>
          </div>
        </Portal>
      </Show>
    </>
  );
};
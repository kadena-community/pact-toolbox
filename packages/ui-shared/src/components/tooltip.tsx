import { Component, JSX, Show, splitProps, createMemo, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';
import { Portal } from 'solid-js/web';

export type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  target: JSX.Element;
  children: string | JSX.Element;
  position?: TooltipPosition;
  showArrow?: boolean;
  delay?: number;
  disabled?: boolean;
  class?: string;
}

const tooltipContainerStyles = css`
  position: relative;
  display: inline-block;
`;

const tooltipStyles = css`
  position: fixed;
  z-index: var(--pact-z-index-popover);
  background-color: var(--pact-color-bg-inverse);
  color: var(--pact-color-text-inverse);
  border-radius: var(--pact-border-radius-base);
  padding: var(--pact-spacing-2) var(--pact-spacing-3);
  font-size: var(--pact-font-size-sm);
  font-weight: var(--pact-font-weight-medium);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--pact-transition-fast) var(--pact-transition-timing);
  box-shadow: var(--pact-tooltip-shadow);
  max-width: 300px;
  word-wrap: break-word;
  white-space: normal;
  backdrop-filter: blur(4px);
`;

const tooltipVisible = css`
  opacity: 1;
`;

interface Position {
  top: number;
  left: number;
  actualPosition: TooltipPosition;
  shouldHide: boolean;
}

// Removed unused tooltip position styles

const arrowStyles = css`
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
`;

const arrowTop = css`
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: var(--pact-spacing-1_5) var(--pact-spacing-1_5) 0 var(--pact-spacing-1_5);
  border-color: var(--pact-color-bg-inverse) transparent transparent transparent;
`;

const arrowBottom = css`
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 var(--pact-spacing-1_5) var(--pact-spacing-1_5) var(--pact-spacing-1_5);
  border-color: transparent transparent var(--pact-color-bg-inverse) transparent;
`;

const arrowLeft = css`
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-width: var(--pact-spacing-1_5) 0 var(--pact-spacing-1_5) var(--pact-spacing-1_5);
  border-color: transparent transparent transparent var(--pact-color-bg-inverse);
`;

const arrowRight = css`
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-width: var(--pact-spacing-1_5) var(--pact-spacing-1_5) var(--pact-spacing-1_5) 0;
  border-color: transparent var(--pact-color-bg-inverse) transparent transparent;
`;

const calculatePosition = (
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferredPosition: TooltipPosition,
  offset: number = 8
): Position => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 8;

  // Check if trigger is too close to viewport edges (hide tooltip if so)
  if (triggerRect.left < margin || triggerRect.right > viewportWidth - margin ||
      triggerRect.top < margin || triggerRect.bottom > viewportHeight - margin) {
    return {
      top: 0,
      left: 0,
      actualPosition: preferredPosition,
      shouldHide: true
    };
  }

  // Calculate available space in each direction
  const spaceBottom = viewportHeight - triggerRect.bottom - margin;
  const spaceTop = triggerRect.top - margin;
  const spaceLeft = triggerRect.left - margin;
  const spaceRight = viewportWidth - triggerRect.right - margin;

  // Determine best position based on available space
  const positions: { position: TooltipPosition; space: number; fits: boolean }[] = [
    {
      position: 'bottom',
      space: spaceBottom,
      fits: spaceBottom >= tooltipRect.height + offset
    },
    {
      position: 'top',
      space: spaceTop,
      fits: spaceTop >= tooltipRect.height + offset
    },
    {
      position: 'right',
      space: spaceRight,
      fits: spaceRight >= tooltipRect.width + offset
    },
    {
      position: 'left',
      space: spaceLeft,
      fits: spaceLeft >= tooltipRect.width + offset
    }
  ];

  // Try preferred position first, then find best alternative
  let actualPosition = preferredPosition;
  const preferredOption = positions.find(p => p.position === preferredPosition);

  if (!preferredOption?.fits) {
    // Find best fitting position
    const fittingPositions = positions.filter(p => p.fits);
    if (fittingPositions.length > 0) {
      // Choose the one with most space
      actualPosition = fittingPositions.sort((a, b) => b.space - a.space)[0].position;
    } else {
      // No good position available, hide the tooltip
      return {
        top: 0,
        left: 0,
        actualPosition: preferredPosition,
        shouldHide: true
      };
    }
  }

  let top = 0;
  let left = 0;

  // Calculate position based on actual position
  switch (actualPosition) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - offset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'bottom':
      top = triggerRect.bottom + offset;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'left':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left - tooltipRect.width - offset;
      break;
    case 'right':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + offset;
      break;
  }

  // Adjust for viewport boundaries (fine-tuning)
  if (left < margin) {
    left = margin;
  } else if (left + tooltipRect.width > viewportWidth - margin) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  if (top < margin) {
    top = margin;
  } else if (top + tooltipRect.height > viewportHeight - margin) {
    top = viewportHeight - tooltipRect.height - margin;
  }

  return { top, left, actualPosition, shouldHide: false };
};

export const PactTooltip: Component<TooltipProps> = (props) => {
  const [local, otherProps] = splitProps(props, [
    'target',
    'children',
    'position',
    'showArrow',
    'delay',
    'disabled',
    'class'
  ]);

  const position = () => local.position || 'top';
  const showArrow = () => local.showArrow ?? true;
  const delay = () => local.delay ?? 500;
  const disabled = () => local.disabled ?? false;

  const [isVisible, setIsVisible] = createSignal(false);
  const [timeoutId, setTimeoutId] = createSignal<ReturnType<typeof setTimeout> | null>(null);
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement>();
  const [tooltipRef, setTooltipRef] = createSignal<HTMLDivElement>();
  const [tooltipPosition, setTooltipPosition] = createSignal<Position>({ top: 0, left: 0, actualPosition: 'top', shouldHide: false });

  const updatePosition = () => {
    const container = containerRef();
    const tooltip = tooltipRef();
    if (!container || !tooltip) return;

    const triggerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const newPosition = calculatePosition(triggerRect, tooltipRect, position());
    setTooltipPosition(newPosition);
  };

  const showTooltip = () => {
    if (disabled()) return;

    const id = setTimeout(() => {
      setIsVisible(true);
      // Use requestAnimationFrame to ensure the tooltip is rendered before calculating position
      requestAnimationFrame(() => {
        requestAnimationFrame(updatePosition);
      });
    }, delay());

    setTimeoutId(id);
  };

  const hideTooltip = () => {
    const id = timeoutId();
    if (id !== null) {
      clearTimeout(id);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const handleMouseEnter = () => {
    showTooltip();
  };

  const handleMouseLeave = () => {
    hideTooltip();
  };

  const handleFocus = () => {
    showTooltip();
  };

  const handleBlur = () => {
    hideTooltip();
  };

  const handleResize = () => {
    if (isVisible()) {
      updatePosition();
    }
  };

  onMount(() => {
    const container = containerRef();
    if (!container) return;

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('focus', handleFocus, true);
    container.addEventListener('blur', handleBlur, true);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    onCleanup(() => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('focus', handleFocus, true);
      container.removeEventListener('blur', handleBlur, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);

      const id = timeoutId();
      if (id !== null) {
        clearTimeout(id);
      }
    });
  });

  // Update position when tooltip is visible
  createEffect(() => {
    if (isVisible()) {
      updatePosition();
    }
  });

  const tooltipClasses = createMemo(() => clsx(
    tooltipStyles,
    isVisible() && tooltipVisible,
    local.class
  ));

  const arrowClasses = createMemo(() => clsx(
    arrowStyles,
    tooltipPosition().actualPosition === 'top' && arrowTop,
    tooltipPosition().actualPosition === 'bottom' && arrowBottom,
    tooltipPosition().actualPosition === 'left' && arrowLeft,
    tooltipPosition().actualPosition === 'right' && arrowRight
  ));

  return (
    <div
      ref={setContainerRef}
      class={tooltipContainerStyles}
      {...otherProps}
    >
      {local.target}
      <Show when={!disabled() && isVisible() && !tooltipPosition().shouldHide}>
        <Portal>
          <div
            ref={setTooltipRef}
            class={tooltipClasses()}
            style={{
              top: `${tooltipPosition().top}px`,
              left: `${tooltipPosition().left}px`,
            }}
            role="tooltip"
            aria-hidden={!isVisible()}
          >
            {local.children}
            <Show when={showArrow()}>
              <div class={arrowClasses()} />
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
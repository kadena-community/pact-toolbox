import { Component, JSX, Show, splitProps, createSignal, onCleanup, createMemo } from 'solid-js';
import { Portal } from 'solid-js/web';
import { css, keyframes } from 'goober';
import { clsx } from 'clsx';

export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface DrawerProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'title'> {
  open?: boolean;
  onClose?: () => void;
  title?: JSX.Element;
  footer?: JSX.Element;
  children?: JSX.Element;
  position?: DrawerPosition;
  size?: DrawerSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showOverlay?: boolean;
}

const fadeIn = keyframes`
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(4px);
  }
`;

const slideInLeft = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
`;

const slideInRight = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`;

const slideInTop = keyframes`
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
`;

const slideInBottom = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`;

const overlayStyles = css`
  position: fixed;
  inset: 0;
  background-color: var(--pact-color-bg-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: var(--pact-z-index-modal-backdrop);
  animation: ${fadeIn} var(--pact-transition-base) var(--pact-transition-timing);
`;

const drawerBaseStyles = css`
  position: fixed;
  background-color: var(--pact-color-bg-elevated);
  border: 1px solid var(--pact-color-border-primary);
  box-shadow: var(--pact-modal-shadow);
  display: flex;
  flex-direction: column;
  z-index: var(--pact-z-index-modal);
  overflow: hidden;
`;

// Position styles
const drawerLeft = css`
  top: 0;
  left: 0;
  height: 100vh;
  border-right: 1px solid var(--pact-color-border-secondary);
  border-radius: 0 var(--pact-border-radius-lg) var(--pact-border-radius-lg) 0;
  animation: ${slideInLeft} var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
`;

const drawerRight = css`
  top: 0;
  right: 0;
  height: 100vh;
  border-left: 1px solid var(--pact-color-border-secondary);
  border-radius: var(--pact-border-radius-lg) 0 0 var(--pact-border-radius-lg);
  animation: ${slideInRight} var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
`;

const drawerTop = css`
  top: 0;
  left: 0;
  right: 0;
  border-bottom: 1px solid var(--pact-color-border-secondary);
  border-radius: 0 0 var(--pact-border-radius-lg) var(--pact-border-radius-lg);
  animation: ${slideInTop} var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
`;

const drawerBottom = css`
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 1px solid var(--pact-color-border-secondary);
  border-radius: var(--pact-border-radius-lg) var(--pact-border-radius-lg) 0 0;
  animation: ${slideInBottom} var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
`;

// Size styles for horizontal drawers (left/right)
const horizontalSizes = {
  sm: css`
    width: 280px;
  `,
  md: css`
    width: 360px;
  `,
  lg: css`
    width: 480px;
  `,
  xl: css`
    width: 640px;
  `,
  full: css`
    width: 100vw;
  `
};

// Size styles for vertical drawers (top/bottom)
const verticalSizes = {
  sm: css`
    height: 200px;
  `,
  md: css`
    height: 300px;
  `,
  lg: css`
    height: 400px;
  `,
  xl: css`
    height: 500px;
  `,
  full: css`
    height: 100vh;
  `
};

const drawerHeaderStyles = css`
  padding: var(--pact-spacing-5) var(--pact-spacing-6);
  border-bottom: 1px solid var(--pact-color-border-primary);
  background-color: var(--pact-color-bg-accent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  min-height: 64px;
`;

const drawerTitleStyles = css`
  margin: 0;
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
  letter-spacing: -0.01em;
  line-height: 1.4;
`;

const drawerBodyStyles = css`
  padding: var(--pact-spacing-6);
  overflow-y: auto;
  flex: 1;
  background-color: var(--pact-color-bg-primary);
`;

const drawerFooterStyles = css`
  padding: var(--pact-spacing-4) var(--pact-spacing-6) var(--pact-spacing-5);
  border-top: 1px solid var(--pact-color-border-primary);
  background-color: var(--pact-color-bg-accent);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--pact-spacing-3);
  flex-shrink: 0;
  min-height: 64px;
`;

const closeButtonStyles = css`
  background: transparent;
  border: none;
  padding: var(--pact-spacing-1_5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--pact-border-radius-md);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  color: var(--pact-color-text-tertiary);
  min-width: 32px;
  min-height: 32px;

  &:hover {
    background-color: var(--pact-color-bg-tertiary);
    color: var(--pact-color-text-primary);
    transform: rotate(90deg);
  }

  &:active {
    transform: rotate(90deg) scale(var(--pact-active-scale));
  }

  &:focus-visible {
    box-shadow: var(--pact-focus-ring);
  }
`;

export const PactDrawer: Component<DrawerProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'footer',
    'children',
    'position',
    'size',
    'closeOnOverlayClick',
    'closeOnEscape',
    'showOverlay'
  ]);

  const position = () => local.position || 'right';
  const size = () => local.size || 'md';
  const closeOnOverlayClick = () => local.closeOnOverlayClick ?? true;
  const closeOnEscape = () => local.closeOnEscape ?? true;
  const showOverlay = () => local.showOverlay ?? true;

  const isHorizontal = () => position() === 'left' || position() === 'right';
  const isVertical = () => position() === 'top' || position() === 'bottom';

  const drawerClasses = createMemo(() => clsx(
    drawerBaseStyles,
    position() === 'left' && drawerLeft,
    position() === 'right' && drawerRight,
    position() === 'top' && drawerTop,
    position() === 'bottom' && drawerBottom,
    isHorizontal() && horizontalSizes[size()],
    isVertical() && verticalSizes[size()],
    divProps.class
  ));

  const handleOverlayClick = (e: MouseEvent) => {
    if (closeOnOverlayClick() && e.target === e.currentTarget) {
      local.onClose?.();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (closeOnEscape() && e.key === 'Escape') {
      local.onClose?.();
    }
  };

  // Add keyboard listener when drawer is open
  const [isOpen, setIsOpen] = createSignal(false);

  // Update isOpen when prop changes
  const open = () => {
    const isCurrentlyOpen = local.open ?? false;
    if (isCurrentlyOpen !== isOpen()) {
      setIsOpen(isCurrentlyOpen);

      if (isCurrentlyOpen && closeOnEscape()) {
        document.addEventListener('keydown', handleKeyDown);
      }
    }
    return isCurrentlyOpen;
  };

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={open()}>
      <Portal>
        <Show when={showOverlay()}>
          <div class={overlayStyles} onClick={handleOverlayClick} />
        </Show>
        <div
          {...divProps}
          class={drawerClasses()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={local.title ? "drawer-title" : undefined}
        >
          <Show when={local.title}>
            <div class={drawerHeaderStyles}>
              <h2 id="drawer-title" class={drawerTitleStyles}>{local.title}</h2>
              <Show when={local.onClose}>
                <button
                  class={closeButtonStyles}
                  onClick={() => local.onClose?.()}
                  aria-label="Close drawer"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13.5 4.5L4.5 13.5M4.5 4.5l9 9" />
                  </svg>
                </button>
              </Show>
            </div>
          </Show>
          <div class={drawerBodyStyles}>
            {local.children}
          </div>
          <Show when={local.footer}>
            <div class={drawerFooterStyles}>
              {local.footer}
            </div>
          </Show>
        </div>
      </Portal>
    </Show>
  );
};
import { Component, JSX, Show, splitProps, createSignal, onCleanup, createMemo } from 'solid-js';
import { Portal } from 'solid-js/web';
import { css, keyframes } from 'goober';
import { clsx } from 'clsx';

interface ModalProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'title'> {
  open?: boolean;
  onClose?: () => void;
  title?: JSX.Element;
  footer?: JSX.Element;
  children?: JSX.Element;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const fadeIn = keyframes`
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(8px);
  }
`;

const slideUp = keyframes`
  from {
    transform: translateY(40px) scale(0.95);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
`;

const overlayStyles = css`
  position: fixed;
  inset: 0;
  background-color: var(--pact-color-bg-overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--pact-spacing-6);
  z-index: var(--pact-z-index-modal-backdrop);
  animation: ${fadeIn} var(--pact-transition-base) var(--pact-transition-timing);
`;

const modalContainerStyles = css`
  background-color: var(--pact-color-bg-elevated);
  border: 1px solid var(--pact-color-border-primary);
  border-radius: var(--pact-border-radius-xl);
  box-shadow: var(--pact-modal-shadow);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 4rem);
  width: 100%;
  z-index: var(--pact-z-index-modal);
  animation: ${slideUp} var(--pact-transition-base) cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
`;

const modalMaxWidthSm = css`
  max-width: 400px;
`;

const modalMaxWidthMd = css`
  max-width: 600px;
`;

const modalMaxWidthLg = css`
  max-width: 800px;
`;

const modalMaxWidthXl = css`
  max-width: 1200px;
`;

const modalMaxWidthFull = css`
  max-width: 100%;
`;

const modalHeaderStyles = css`
  padding: var(--pact-spacing-5) var(--pact-spacing-6);
  border-bottom: 1px solid var(--pact-color-border-primary);
  background-color: var(--pact-color-bg-accent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  min-height: 64px;
`;

const modalTitleStyles = css`
  margin: 0;
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
  letter-spacing: -0.01em;
  line-height: 1.4;
`;

const modalBodyStyles = css`
  padding: var(--pact-spacing-6);
  overflow-y: auto;
  flex: 1;
  background-color: var(--pact-color-bg-primary);
`;

const modalFooterStyles = css`
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

export const PactModal: Component<ModalProps> = (props) => {
  const [local, divProps] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'footer',
    'children',
    'closeOnOverlayClick',
    'closeOnEscape',
    'maxWidth'
  ]);

  const closeOnOverlayClick = () => local.closeOnOverlayClick ?? true;
  const closeOnEscape = () => local.closeOnEscape ?? true;
  const maxWidth = () => local.maxWidth || 'md';

  const modalContainerClasses = createMemo(() => clsx(
    modalContainerStyles,
    maxWidth() === 'sm' && modalMaxWidthSm,
    maxWidth() === 'md' && modalMaxWidthMd,
    maxWidth() === 'lg' && modalMaxWidthLg,
    maxWidth() === 'xl' && modalMaxWidthXl,
    maxWidth() === 'full' && modalMaxWidthFull,
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

  // Add keyboard listener when modal is open
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
        <div class={overlayStyles} onClick={handleOverlayClick}>
          <div
            {...divProps}
            class={modalContainerClasses()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e: MouseEvent) => e.stopPropagation()}
          >
            <Show when={local.title}>
              <div class={modalHeaderStyles}>
                <h2 id="modal-title" class={modalTitleStyles}>{local.title}</h2>
                <button
                  class={closeButtonStyles}
                  onClick={() => local.onClose?.()}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 5L5 15M5 5l10 10" />
                  </svg>
                </button>
              </div>
            </Show>
            <div class={modalBodyStyles}>
              {local.children}
            </div>
            <Show when={local.footer}>
              <div class={modalFooterStyles}>
                {local.footer}
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { animations } from "../styles/animations";

@customElement("pact-modal")
export class PactModal extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) heading = "";
  @property({ type: Boolean }) showClose = true;
  @property({ type: Boolean }) preventClose = false;
  @property({ type: String }) size: "sm" | "md" | "lg" | "xl" | "full" = "md";

  @state() private isClosing = false;
  private boundKeydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    super();
    this.boundKeydownHandler = this.handleKeyDown.bind(this);
  }

  static override styles = [
    baseStyles,
    animations,
    css`
      :host {
        display: none;
      }

      :host([open]) {
        display: block;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background-color: var(--pact-color-bg-overlay);
        z-index: var(--pact-z-index-modal-backdrop);
        animation: fadeIn var(--pact-transition-base) var(--pact-transition-timing);
      }

      .modal-backdrop.closing {
        animation: fadeOut var(--pact-transition-base) var(--pact-transition-timing);
      }

      .modal-container {
        position: fixed;
        inset: 0;
        z-index: var(--pact-z-index-modal);
        overflow-y: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--pact-spacing-md);
      }

      .modal {
        background-color: var(--pact-color-bg-primary);
        border-radius: var(--pact-border-radius-lg);
        box-shadow: var(--pact-modal-shadow);
        width: 100%;
        max-height: calc(100vh - 2rem);
        display: flex;
        flex-direction: column;
        animation: scaleIn var(--pact-transition-base) var(--pact-transition-timing);
      }

      .modal.closing {
        animation: scaleOut var(--pact-transition-base) var(--pact-transition-timing);
      }

      /* Size variants */
      .modal.size-sm {
        max-width: 24rem;
      }
      .modal.size-md {
        max-width: 32rem;
      }
      .modal.size-lg {
        max-width: 48rem;
      }
      .modal.size-xl {
        max-width: 64rem;
      }
      .modal.size-full {
        max-width: calc(100vw - 2rem);
        max-height: calc(100vh - 2rem);
      }

      .modal-header {
        padding: var(--pact-spacing-lg);
        border-bottom: var(--pact-border-width) solid var(--pact-color-border-primary);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .modal-heading {
        font-size: var(--pact-font-size-xl);
        font-weight: var(--pact-font-weight-semibold);
        margin: 0;
        color: var(--pact-color-text-primary);
      }

      .modal-close {
        background: none;
        border: none;
        font-size: var(--pact-font-size-2xl);
        color: var(--pact-color-text-secondary);
        cursor: pointer;
        padding: 0;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--pact-border-radius-base);
        transition: all var(--pact-transition-fast) var(--pact-transition-timing);
      }

      .modal-close:hover {
        background-color: var(--pact-color-bg-secondary);
        color: var(--pact-color-text-primary);
      }

      .modal-close:focus-visible {
        outline: 2px solid var(--pact-color-border-focus);
        outline-offset: 2px;
      }

      .modal-body {
        padding: var(--pact-spacing-lg);
        overflow-y: auto;
        flex: 1;
      }

      .modal-footer {
        padding: var(--pact-spacing-lg);
        border-top: var(--pact-border-width) solid var(--pact-color-border-primary);
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--pact-spacing-sm);
        flex-shrink: 0;
      }

      /* Mobile styles */
      @media (max-width: 640px) {
        .modal-container {
          padding: 0;
        }

        .modal:not(.size-full) {
          max-width: 100%;
          max-height: 100%;
          height: 100%;
          border-radius: 0;
        }
      }
    `,
  ];

  private handleClose() {
    if (this.preventClose) return;
    this.close();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && !this.preventClose) {
      this.close();
    }
  }

  async close() {
    this.isClosing = true;
    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for animation
    this.open = false;
    this.isClosing = false;
    this.dispatchEvent(new CustomEvent("close"));
  }

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.boundKeydownHandler);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.boundKeydownHandler);
  }

  override render() {
    if (!this.open && !this.isClosing) return null;

    const modalClass = `modal size-${this.size} ${this.isClosing ? "closing" : ""}`;

    return html`
      <div class="modal-backdrop ${this.isClosing ? "closing" : ""}" @click=${this.handleClose} part="backdrop"></div>
      <div class="modal-container" @click=${this.handleClose}>
        <div
          class=${modalClass}
          @click=${(e: Event) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-heading"
          part="modal"
        >
          ${this.heading || this.showClose
            ? html`
                <div class="modal-header" part="header">
                  <h2 id="modal-heading" class="modal-heading">${this.heading}</h2>
                  ${this.showClose
                    ? html`
                        <button class="modal-close" @click=${this.close} aria-label="Close modal" part="close-button">
                          <span aria-hidden="true">×</span>
                        </button>
                      `
                    : ""}
                </div>
              `
            : ""}

          <div class="modal-body" part="body">
            <slot></slot>
          </div>

          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }
}

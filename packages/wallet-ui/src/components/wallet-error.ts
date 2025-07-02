import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { formatWalletError } from "@pact-toolbox/wallet-core";
import "@pact-toolbox/ui-shared";

@customElement("pact-wallet-error")
export class PactWalletError extends LitElement {
  @property({ type: Object }) error: unknown = null;
  @property({ type: Function }) onRetry?: () => void;
  @property({ type: Function }) onDismiss?: () => void;

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .error-container {
        padding: var(--pact-spacing-lg);
        background: var(--pact-color-error-light);
        border: var(--pact-border-width) solid var(--pact-color-error);
        border-radius: var(--pact-border-radius-base);
        color: var(--pact-color-text-primary);
      }

      .error-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--pact-spacing-sm);
      }

      .error-title {
        font-size: var(--pact-font-size-lg);
        font-weight: var(--pact-font-weight-semibold);
        color: var(--pact-color-error);
        margin: 0;
      }

      .error-message {
        margin: 0 0 var(--pact-spacing-sm) 0;
        color: var(--pact-color-text-secondary);
      }

      .error-action {
        margin: 0;
        color: var(--pact-color-text-secondary);
        font-size: var(--pact-font-size-sm);
        font-style: italic;
      }

      .error-buttons {
        display: flex;
        gap: var(--pact-spacing-sm);
        margin-top: var(--pact-spacing-md);
      }

      .close-button {
        background: none;
        border: none;
        color: var(--pact-color-error);
        cursor: pointer;
        padding: var(--pact-spacing-xs);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--pact-border-radius-sm);
        transition: background-color var(--pact-transition-fast);
      }

      .close-button:hover {
        background: var(--pact-color-bg-secondary);
      }

      .error-icon {
        width: 20px;
        height: 20px;
        display: inline-block;
        margin-right: var(--pact-spacing-xs);
        vertical-align: middle;
      }
    `,
  ];

  override render() {
    if (!this.error) return html``;

    const errorInfo = formatWalletError(this.error);

    return html`
      <div class="error-container">
        <div class="error-header">
          <h3 class="error-title">
            <span class="error-icon">⚠️</span>
            ${errorInfo.title}
          </h3>
          ${this.onDismiss
            ? html`
                <button
                  class="close-button"
                  @click=${this.onDismiss}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              `
            : ""}
        </div>
        
        <p class="error-message">${errorInfo.message}</p>
        
        ${errorInfo.action
          ? html`<p class="error-action">${errorInfo.action}</p>`
          : ""}
        
        ${errorInfo.retryable && this.onRetry
          ? html`
              <div class="error-buttons">
                <pact-button
                  variant="primary"
                  size="sm"
                  @click=${this.onRetry}
                >
                  Try Again
                </pact-button>
                ${this.onDismiss
                  ? html`
                      <pact-button
                        variant="ghost"
                        size="sm"
                        @click=${this.onDismiss}
                      >
                        Cancel
                      </pact-button>
                    `
                  : ""}
              </div>
            `
          : ""}
      </div>
    `;
  }
}
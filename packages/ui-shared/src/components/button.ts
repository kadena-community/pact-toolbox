import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "../styles/base";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

@customElement("pact-button")
export class PactButton extends LitElement {
  @property({ type: String }) variant: ButtonVariant = "primary";
  @property({ type: String }) size: ButtonSize = "md";
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) type: "button" | "submit" | "reset" = "button";
  @property({ type: Boolean }) fullWidth = false;

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
        width: var(--pact-button-width, auto);
      }

      :host([fullWidth]) {
        width: 100%;
      }

      button {
        font-family: inherit;
        font-weight: var(--pact-font-weight-medium);
        border: var(--pact-border-width) solid transparent;
        border-radius: var(--pact-border-radius-base);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--pact-spacing-sm);
        transition: all var(--pact-transition-fast) var(--pact-transition-timing);
        position: relative;
        width: 100%;
        text-decoration: none;
        outline: none;
      }

      /* Size variants */
      button.size-sm {
        padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
        font-size: var(--pact-font-size-sm);
        min-height: 32px;
      }

      button.size-md {
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
        font-size: var(--pact-font-size-base);
        min-height: 40px;
      }

      button.size-lg {
        padding: var(--pact-spacing-md) var(--pact-spacing-lg);
        font-size: var(--pact-font-size-lg);
        min-height: 48px;
      }

      /* Variant styles */
      button.variant-primary {
        background-color: var(--pact-color-primary);
        color: var(--pact-color-text-inverse);
        box-shadow: var(--pact-button-shadow);
      }

      button.variant-primary:hover:not(:disabled) {
        background-color: var(--pact-color-primary-hover);
        box-shadow: var(--pact-button-shadow-hover);
      }

      button.variant-secondary {
        background-color: var(--pact-color-bg-secondary);
        color: var(--pact-color-text-primary);
        border-color: var(--pact-color-border-primary);
      }

      button.variant-secondary:hover:not(:disabled) {
        background-color: var(--pact-color-bg-tertiary);
        border-color: var(--pact-color-border-secondary);
      }

      button.variant-ghost {
        background-color: transparent;
        color: var(--pact-color-text-primary);
      }

      button.variant-ghost:hover:not(:disabled) {
        background-color: var(--pact-color-bg-secondary);
      }

      button.variant-danger {
        background-color: var(--pact-color-error);
        color: var(--pact-color-text-inverse);
        box-shadow: var(--pact-button-shadow);
      }

      button.variant-danger:hover:not(:disabled) {
        background-color: var(--pact-color-error-dark);
        box-shadow: var(--pact-button-shadow-hover);
      }

      /* States */
      button:focus-visible {
        outline: 2px solid var(--pact-color-border-focus);
        outline-offset: 2px;
      }

      button:active:not(:disabled) {
        transform: scale(0.98);
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Loading state */
      .spinner {
        display: inline-block;
        width: 1em;
        height: 1em;
        border: 2px solid currentColor;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .content {
        visibility: var(--content-visibility, visible);
      }

      :host([loading]) .content {
        visibility: hidden;
      }

      .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
    `,
  ];

  override render() {
    const classes = `variant-${this.variant} size-${this.size}`;

    return html`
      <button class=${classes} ?disabled=${this.disabled || this.loading} type=${this.type} part="button">
        ${this.loading ? html`<span class="loader"><span class="spinner"></span></span>` : ""}
        <span class="content">
          <slot></slot>
        </span>
      </button>
    `;
  }
}

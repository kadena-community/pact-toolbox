import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "../styles/base";

export type BadgeVariant = "default" | "primary" | "secondary" | "success" | "error" | "warning" | "info";
export type BadgeSize = "sm" | "md";

@customElement("pact-badge")
export class PactBadge extends LitElement {
  @property({ type: String }) variant: BadgeVariant = "default";
  @property({ type: String }) size: BadgeSize = "md";
  @property({ type: Boolean }) dot = false;

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: var(--pact-font-weight-medium);
        border-radius: var(--pact-border-radius-full);
        transition: all var(--pact-transition-fast) var(--pact-transition-timing);
      }

      /* Size variants */
      .badge.size-sm:not(.dot) {
        padding: 0 var(--pact-spacing-xs);
        font-size: var(--pact-font-size-xs);
        min-height: 1.25rem;
        min-width: 1.25rem;
      }

      .badge.size-md:not(.dot) {
        padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
        font-size: var(--pact-font-size-sm);
        min-height: 1.5rem;
        min-width: 1.5rem;
      }

      /* Dot variant */
      .badge.dot {
        padding: 0;
        width: 0.5rem;
        height: 0.5rem;
      }

      .badge.dot.size-md {
        width: 0.625rem;
        height: 0.625rem;
      }

      /* Color variants */
      .badge.variant-default {
        background-color: var(--pact-color-bg-secondary);
        color: var(--pact-color-text-primary);
      }

      .badge.variant-primary {
        background-color: var(--pact-color-primary);
        color: var(--pact-color-text-inverse);
      }

      .badge.variant-secondary {
        background-color: var(--pact-color-secondary);
        color: var(--pact-color-text-inverse);
      }

      .badge.variant-success {
        background-color: var(--pact-color-success);
        color: var(--pact-color-text-inverse);
      }

      .badge.variant-error {
        background-color: var(--pact-color-error);
        color: var(--pact-color-text-inverse);
      }

      .badge.variant-warning {
        background-color: var(--pact-color-warning);
        color: var(--pact-color-text-inverse);
      }

      .badge.variant-info {
        background-color: var(--pact-color-info);
        color: var(--pact-color-text-inverse);
      }

      /* Subtle variants for better contrast in light theme */
      :host-context([data-pact-theme="light"]) .badge.variant-warning {
        background-color: var(--pact-color-warning-light);
        color: var(--pact-color-warning-dark);
      }
    `,
  ];

  override render() {
    const classes = ["badge", `variant-${this.variant}`, `size-${this.size}`, this.dot ? "dot" : ""]
      .filter(Boolean)
      .join(" ");

    return html` <span class=${classes} part="badge"> ${!this.dot ? html`<slot></slot>` : ""} </span> `;
  }
}

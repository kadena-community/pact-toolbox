import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { animations } from "../styles/animations";

@customElement("pact-spinner")
export class PactSpinner extends LitElement {
  @property({ type: String }) size: "sm" | "md" | "lg" = "md";
  @property({ type: String }) color: "primary" | "secondary" | "current" = "primary";

  static override styles = [
    baseStyles,
    animations,
    css`
      :host {
        display: inline-block;
      }

      .spinner {
        display: inline-block;
        border: 3px solid;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 0.8s linear infinite;
      }

      /* Size variants */
      .spinner.size-sm {
        width: 1rem;
        height: 1rem;
        border-width: 2px;
      }

      .spinner.size-md {
        width: 1.5rem;
        height: 1.5rem;
        border-width: 3px;
      }

      .spinner.size-lg {
        width: 2rem;
        height: 2rem;
        border-width: 4px;
      }

      /* Color variants */
      .spinner.color-primary {
        border-color: var(--pact-color-primary);
        border-top-color: transparent;
      }

      .spinner.color-secondary {
        border-color: var(--pact-color-secondary);
        border-top-color: transparent;
      }

      .spinner.color-current {
        border-color: currentColor;
        border-top-color: transparent;
      }
    `,
  ];

  override render() {
    const classes = `spinner size-${this.size} color-${this.color}`;

    return html`
      <div class=${classes} role="status" aria-label="Loading" part="spinner">
        <span class="sr-only">Loading...</span>
      </div>
    `;
  }
}

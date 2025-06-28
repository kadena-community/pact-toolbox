import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "../styles/base";

@customElement("pact-card")
export class PactCard extends LitElement {
  @property({ type: Boolean }) hoverable = false;
  @property({ type: Boolean }) clickable = false;
  @property({ type: String }) padding: "none" | "sm" | "md" | "lg" = "md";

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .card {
        background-color: var(--pact-color-bg-primary);
        border: var(--pact-border-width) solid var(--pact-color-border-primary);
        border-radius: var(--pact-border-radius-lg);
        box-shadow: var(--pact-card-shadow);
        transition: all var(--pact-transition-fast) var(--pact-transition-timing);
        height: 100%;
      }

      /* Padding variants */
      .card.padding-none {
        padding: 0;
      }

      .card.padding-sm {
        padding: var(--pact-spacing-sm);
      }

      .card.padding-md {
        padding: var(--pact-spacing-md);
      }

      .card.padding-lg {
        padding: var(--pact-spacing-lg);
      }

      /* Interactive states */
      .card.hoverable:hover {
        box-shadow: var(--pact-shadow-lg);
        transform: translateY(-2px);
      }

      .card.clickable {
        cursor: pointer;
      }

      .card.clickable:active {
        transform: translateY(0);
      }

      /* Card sections */
      ::slotted([slot="header"]) {
        margin: calc(var(--pact-spacing-md) * -1);
        margin-bottom: var(--pact-spacing-md);
        padding: var(--pact-spacing-md);
        border-bottom: var(--pact-border-width) solid var(--pact-color-border-primary);
      }

      ::slotted([slot="footer"]) {
        margin: calc(var(--pact-spacing-md) * -1);
        margin-top: var(--pact-spacing-md);
        padding: var(--pact-spacing-md);
        border-top: var(--pact-border-width) solid var(--pact-color-border-primary);
      }

      /* Adjust margins for different padding sizes */
      :host([padding="sm"]) ::slotted([slot="header"]),
      :host([padding="sm"]) ::slotted([slot="footer"]) {
        margin: calc(var(--pact-spacing-sm) * -1);
        padding: var(--pact-spacing-sm);
      }

      :host([padding="sm"]) ::slotted([slot="header"]) {
        margin-bottom: var(--pact-spacing-sm);
      }

      :host([padding="sm"]) ::slotted([slot="footer"]) {
        margin-top: var(--pact-spacing-sm);
      }

      :host([padding="lg"]) ::slotted([slot="header"]),
      :host([padding="lg"]) ::slotted([slot="footer"]) {
        margin: calc(var(--pact-spacing-lg) * -1);
        padding: var(--pact-spacing-lg);
      }

      :host([padding="lg"]) ::slotted([slot="header"]) {
        margin-bottom: var(--pact-spacing-lg);
      }

      :host([padding="lg"]) ::slotted([slot="footer"]) {
        margin-top: var(--pact-spacing-lg);
      }

      :host([padding="none"]) ::slotted([slot="header"]),
      :host([padding="none"]) ::slotted([slot="footer"]) {
        margin: 0;
        padding: var(--pact-spacing-md);
      }
    `,
  ];

  override render() {
    const classes = [
      "card",
      `padding-${this.padding}`,
      this.hoverable ? "hoverable" : "",
      this.clickable ? "clickable" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return html`
      <div class=${classes} part="card">
        <slot name="header"></slot>
        <slot></slot>
        <slot name="footer"></slot>
      </div>
    `;
  }
}

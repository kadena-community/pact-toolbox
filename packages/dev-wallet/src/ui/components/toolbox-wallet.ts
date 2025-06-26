import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import "./toolbox-wallet-container";

@customElement("pact-dev-wallet")
export class PactDevWallet extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--pact-color-bg-primary, #ffffff);
        color: var(--pact-color-text-primary, #000000);
      }
    `,
  ];

  override render() {
    return html`
      <toolbox-wallet-container></toolbox-wallet-container>
    `;
  }
}
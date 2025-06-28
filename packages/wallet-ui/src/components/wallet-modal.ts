import { css } from "lit";
import { customElement } from "lit/decorators.js";
import { PactModal } from "@pact-toolbox/ui-shared";

/**
 * Wallet modal component that extends the shared PactModal
 * with wallet-specific styling and behavior
 */
@customElement("pact-wallet-modal")
export class PactWalletModal extends PactModal {
  static override styles = [
    ...PactModal.styles,
    css`
      /* Wallet-specific modal styling */
      .modal {
        max-width: 400px;
        width: 100%;
      }

      /* Mobile responsive adjustments */
      @media (max-width: 640px) {
        .modal {
          margin: var(--pact-spacing-sm);
          max-width: calc(100vw - 2rem);
        }
      }
    `
  ];

  constructor() {
    super();
    this.size = 'sm';
  }
}
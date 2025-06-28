import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "../styles/base";

@customElement("pact-input")
export class PactInput extends LitElement {
  @property({ type: String }) value = "";
  @property({ type: String }) type = "text";
  @property({ type: String }) placeholder = "";
  @property({ type: String }) label = "";
  @property({ type: String }) error = "";
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) readonly = false;
  @property({ type: Boolean }) required = false;
  @property({ type: String }) size: "sm" | "md" | "lg" = "md";

  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .input-wrapper {
        display: flex;
        flex-direction: column;
        gap: var(--pact-spacing-xs);
      }

      .label {
        font-size: var(--pact-font-size-sm);
        font-weight: var(--pact-font-weight-medium);
        color: var(--pact-color-text-primary);
      }

      .label.required::after {
        content: " *";
        color: var(--pact-color-error);
      }

      .input {
        width: 100%;
        font-family: inherit;
        font-size: var(--pact-font-size-base);
        color: var(--pact-color-text-primary);
        background-color: var(--pact-color-bg-primary);
        border: var(--pact-border-width) solid var(--pact-color-border-primary);
        border-radius: var(--pact-border-radius-base);
        transition: all var(--pact-transition-fast) var(--pact-transition-timing);
        outline: none;
      }

      /* Size variants */
      .input.size-sm {
        padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
        font-size: var(--pact-font-size-sm);
      }

      .input.size-md {
        padding: var(--pact-spacing-sm) var(--pact-spacing-md);
      }

      .input.size-lg {
        padding: var(--pact-spacing-md) var(--pact-spacing-lg);
        font-size: var(--pact-font-size-lg);
      }

      /* States */
      .input:hover:not(:disabled):not(:focus) {
        border-color: var(--pact-color-border-secondary);
      }

      .input:focus {
        border-color: var(--pact-color-border-focus);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: var(--pact-color-bg-secondary);
      }

      .input:readonly {
        background-color: var(--pact-color-bg-secondary);
      }

      .input.error {
        border-color: var(--pact-color-error);
      }

      .input.error:focus {
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
      }

      .error-message {
        font-size: var(--pact-font-size-sm);
        color: var(--pact-color-error);
      }

      /* Placeholder */
      .input::placeholder {
        color: var(--pact-color-text-tertiary);
      }
    `,
  ];

  override render() {
    const inputClasses = ["input", `size-${this.size}`, this.error ? "error" : ""].filter(Boolean).join(" ");

    return html`
      <div class="input-wrapper" part="wrapper">
        ${this.label
          ? html` <label class="label ${this.required ? "required" : ""}" part="label"> ${this.label} </label> `
          : ""}

        <input
          class=${inputClasses}
          type=${this.type}
          .value=${this.value}
          placeholder=${this.placeholder}
          ?disabled=${this.disabled}
          ?readonly=${this.readonly}
          ?required=${this.required}
          @input=${this.handleInput}
          @change=${this.handleChange}
          part="input"
        />

        ${this.error ? html` <span class="error-message" part="error"> ${this.error} </span> ` : ""}
      </div>
    `;
  }

  private handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.value = input.value;
    this.dispatchEvent(
      new CustomEvent("input", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleChange(e: Event) {
    const input = e.target as HTMLInputElement;
    this.value = input.value;
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

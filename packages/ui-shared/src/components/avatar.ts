import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { getInitials } from "../utils/format";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

@customElement("pact-avatar")
export class PactAvatar extends LitElement {
  @property({ type: String }) src = "";
  @property({ type: String }) alt = "";
  @property({ type: String }) name = "";
  @property({ type: String }) size: AvatarSize = "md";

  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
      }

      .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--pact-border-radius-full);
        background-color: var(--pact-color-bg-tertiary);
        color: var(--pact-color-text-primary);
        font-weight: var(--pact-font-weight-semibold);
        overflow: hidden;
        position: relative;
        user-select: none;
      }

      /* Size variants */
      .avatar.size-xs {
        width: 1.5rem;
        height: 1.5rem;
        font-size: var(--pact-font-size-xs);
      }

      .avatar.size-sm {
        width: 2rem;
        height: 2rem;
        font-size: var(--pact-font-size-sm);
      }

      .avatar.size-md {
        width: 2.5rem;
        height: 2.5rem;
        font-size: var(--pact-font-size-base);
      }

      .avatar.size-lg {
        width: 3rem;
        height: 3rem;
        font-size: var(--pact-font-size-lg);
      }

      .avatar.size-xl {
        width: 4rem;
        height: 4rem;
        font-size: var(--pact-font-size-xl);
      }

      .avatar-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-initials {
        text-transform: uppercase;
      }

      /* Generate consistent colors based on name */
      :host([data-color="0"]) .avatar {
        background-color: #3b82f6;
        color: white;
      }
      :host([data-color="1"]) .avatar {
        background-color: #8b5cf6;
        color: white;
      }
      :host([data-color="2"]) .avatar {
        background-color: #ec4899;
        color: white;
      }
      :host([data-color="3"]) .avatar {
        background-color: #f59e0b;
        color: white;
      }
      :host([data-color="4"]) .avatar {
        background-color: #10b981;
        color: white;
      }
      :host([data-color="5"]) .avatar {
        background-color: #14b8a6;
        color: white;
      }
      :host([data-color="6"]) .avatar {
        background-color: #06b6d4;
        color: white;
      }
      :host([data-color="7"]) .avatar {
        background-color: #6366f1;
        color: white;
      }
    `,
  ];

  private getColorIndex(): number {
    const str = this.name || this.alt || "";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 8;
  }

  override updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("name") || changedProperties.has("alt")) {
      this.setAttribute("data-color", this.getColorIndex().toString());
    }
  }

  override render() {
    const initials = getInitials(this.name || this.alt || "");
    const classes = `avatar size-${this.size}`;

    return html`
      <div class=${classes} part="avatar">
        ${this.src
          ? html`<img
              class="avatar-image"
              src=${this.src}
              alt=${this.alt || this.name}
              @error=${this.handleImageError}
            />`
          : html`<span class="avatar-initials">${initials}</span>`}
      </div>
    `;
  }

  private handleImageError(e: Event) {
    // Hide the broken image
    (e.target as HTMLImageElement).style.display = "none";
    // Re-render to show initials
    this.src = "";
  }
}

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { baseStyles } from "@pact-toolbox/ui-shared";
import { themeMapping } from "../styles/theme-mapping";
import type { WalletScreen } from "../types";

interface NavItem {
  id: WalletScreen;
  label: string;
  icon: string;
}

@customElement("pact-toolbox-bottom-navigation")
export class PactToolboxBottomNavigation extends LitElement {
  @property({ type: String }) currentScreen: WalletScreen = 'accounts';

  private navItems: NavItem[] = [
    { id: 'transactions', label: 'Activity', icon: '📜' },
    { id: 'accounts', label: 'Accounts', icon: '👤' },
    { id: 'networks', label: 'Networks', icon: '🌐' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  static override styles = [
    baseStyles,
    themeMapping,
    css`
      :host {
        display: block;
        background: var(--pact-bg-primary);
        border-top: 1px solid var(--pact-border-color);
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
      }

      .nav-container {
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: var(--pact-spacing-sm) 0;
        height: 56px;
      }

      .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--pact-spacing-xs);
        padding: var(--pact-spacing-xs) var(--pact-spacing-lg);
        background: none;
        border: none;
        cursor: pointer;
        transition: all var(--pact-transition-fast);
        color: var(--pact-text-secondary);
        position: relative;
        font-family: inherit;
      }

      .nav-item:hover {
        color: var(--pact-brand-primary);
      }

      .nav-item.active {
        color: var(--pact-brand-primary);
      }

      .nav-item.active::before {
        content: '';
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 30px;
        height: 3px;
        background: var(--pact-brand-primary);
        border-radius: 2px;
      }

      .nav-icon {
        font-size: 20px;
        line-height: 1;
      }

      .nav-label {
        font-size: 11px;
        font-weight: 500;
      }

      @media (max-width: 400px) {
        .nav-item {
          padding: var(--pact-spacing-xs) var(--pact-spacing-sm);
        }
        
        .nav-label {
          display: none;
        }
      }
    `,
  ];

  private handleNavClick(screen: WalletScreen) {
    this.dispatchEvent(new CustomEvent('toolbox-navigate', {
      detail: { screen },
      bubbles: true,
      composed: true,
    }));
  }

  override render() {
    return html`
      <nav class="nav-container">
        ${this.navItems.map(item => html`
          <button
            class="nav-item ${this.currentScreen === item.id ? 'active' : ''}"
            @click=${() => this.handleNavClick(item.id)}
          >
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
          </button>
        `)}
      </nav>
    `;
  }
}
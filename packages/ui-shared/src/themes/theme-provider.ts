import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Theme provider component that sets CSS custom properties for all child components.
 * This follows the theme provider pattern used by modern web component libraries.
 * 
 * Usage:
 * <pact-theme-provider theme="light">
 *   <your-app></your-app>
 * </pact-theme-provider>
 */
@customElement('pact-theme-provider')
export class PactThemeProvider extends LitElement {
  @property({ type: String, reflect: true }) theme: 'light' | 'dark' | 'auto' = 'light';

  static override styles = css`
    :host {
      display: block;
      /* Base variables that don't change with theme */
      --pact-spacing-xs: 0.25rem;
      --pact-spacing-sm: 0.5rem;
      --pact-spacing-md: 1rem;
      --pact-spacing-lg: 1.5rem;
      --pact-spacing-xl: 2rem;
      --pact-spacing-2xl: 3rem;

      --pact-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --pact-font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      --pact-font-size-xs: 0.75rem;
      --pact-font-size-sm: 0.875rem;
      --pact-font-size-base: 1rem;
      --pact-font-size-lg: 1.125rem;
      --pact-font-size-xl: 1.25rem;
      --pact-font-size-2xl: 1.5rem;
      --pact-font-weight-normal: 400;
      --pact-font-weight-medium: 500;
      --pact-font-weight-semibold: 600;
      --pact-font-weight-bold: 700;
      --pact-line-height-tight: 1.25;
      --pact-line-height-normal: 1.5;
      --pact-line-height-relaxed: 1.75;

      --pact-border-width: 1px;
      --pact-border-radius-sm: 0.375rem;
      --pact-border-radius-base: 0.5rem;
      --pact-border-radius-lg: 0.75rem;
      --pact-border-radius-xl: 1rem;
      --pact-border-radius-full: 9999px;

      --pact-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --pact-shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      --pact-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --pact-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --pact-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

      --pact-transition-fast: 150ms;
      --pact-transition-base: 200ms;
      --pact-transition-slow: 300ms;
      --pact-transition-timing: cubic-bezier(0.4, 0, 0.2, 1);

      --pact-z-index-base: 1;
      --pact-z-index-dropdown: 1000;
      --pact-z-index-sticky: 1020;
      --pact-z-index-fixed: 1030;
      --pact-z-index-modal-backdrop: 1040;
      --pact-z-index-modal: 1050;
      --pact-z-index-popover: 1060;
      --pact-z-index-tooltip: 1070;
    }

    /* Light theme */
    :host([theme="light"]) {
      --pact-color-bg-primary: #ffffff;
      --pact-color-bg-secondary: #f8fafc;
      --pact-color-bg-tertiary: #f1f5f9;
      --pact-color-bg-overlay: rgba(0, 0, 0, 0.5);

      --pact-color-text-primary: #0f172a;
      --pact-color-text-secondary: #64748b;
      --pact-color-text-tertiary: #94a3b8;
      --pact-color-text-inverse: #ffffff;

      --pact-color-border-primary: #e2e8f0;
      --pact-color-border-secondary: #cbd5e1;
      --pact-color-border-focus: #3b82f6;

      --pact-color-primary: #3b82f6;
      --pact-color-primary-hover: #2563eb;
      --pact-color-primary-light: #dbeafe;
      --pact-color-primary-dark: #1e40af;

      --pact-color-secondary: #8b5cf6;
      --pact-color-secondary-hover: #7c3aed;
      --pact-color-secondary-light: #ede9fe;
      --pact-color-secondary-dark: #5b21b6;

      --pact-color-success: #10b981;
      --pact-color-success-light: #d1fae5;
      --pact-color-success-dark: #047857;

      --pact-color-error: #ef4444;
      --pact-color-error-light: #fee2e2;
      --pact-color-error-dark: #b91c1c;

      --pact-color-warning: #f59e0b;
      --pact-color-warning-light: #fef3c7;
      --pact-color-warning-dark: #b45309;

      --pact-color-info: #3b82f6;
      --pact-color-info-light: #dbeafe;
      --pact-color-info-dark: #1e40af;

      --pact-color-gray-50: #f8fafc;
      --pact-color-gray-100: #f1f5f9;
      --pact-color-gray-200: #e2e8f0;
      --pact-color-gray-300: #cbd5e1;
      --pact-color-gray-400: #94a3b8;
      --pact-color-gray-500: #64748b;
      --pact-color-gray-600: #475569;
      --pact-color-gray-700: #334155;
      --pact-color-gray-800: #1e293b;
      --pact-color-gray-900: #0f172a;

      --pact-button-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --pact-button-shadow-hover: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      --pact-input-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --pact-card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      --pact-modal-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

      --pact-scrollbar-track: #f1f5f9;
      --pact-scrollbar-thumb: #cbd5e1;
      --pact-scrollbar-thumb-hover: #94a3b8;
    }

    /* Dark theme */
    :host([theme="dark"]) {
      --pact-color-bg-primary: #0f172a;
      --pact-color-bg-secondary: #1e293b;
      --pact-color-bg-tertiary: #334155;
      --pact-color-bg-overlay: rgba(0, 0, 0, 0.7);

      --pact-color-text-primary: #f8fafc;
      --pact-color-text-secondary: #cbd5e1;
      --pact-color-text-tertiary: #94a3b8;
      --pact-color-text-inverse: #0f172a;

      --pact-color-border-primary: #334155;
      --pact-color-border-secondary: #475569;
      --pact-color-border-focus: #3b82f6;

      --pact-color-primary: #3b82f6;
      --pact-color-primary-hover: #60a5fa;
      --pact-color-primary-light: #1e3a8a;
      --pact-color-primary-dark: #2563eb;

      --pact-color-secondary: #8b5cf6;
      --pact-color-secondary-hover: #a78bfa;
      --pact-color-secondary-light: #4c1d95;
      --pact-color-secondary-dark: #7c3aed;

      --pact-color-success: #10b981;
      --pact-color-success-light: #064e3b;
      --pact-color-success-dark: #34d399;

      --pact-color-error: #ef4444;
      --pact-color-error-light: #7f1d1d;
      --pact-color-error-dark: #f87171;

      --pact-color-warning: #f59e0b;
      --pact-color-warning-light: #78350f;
      --pact-color-warning-dark: #fbbf24;

      --pact-color-info: #3b82f6;
      --pact-color-info-light: #1e3a8a;
      --pact-color-info-dark: #60a5fa;

      --pact-color-gray-50: #0f172a;
      --pact-color-gray-100: #1e293b;
      --pact-color-gray-200: #334155;
      --pact-color-gray-300: #475569;
      --pact-color-gray-400: #64748b;
      --pact-color-gray-500: #94a3b8;
      --pact-color-gray-600: #cbd5e1;
      --pact-color-gray-700: #e2e8f0;
      --pact-color-gray-800: #f1f5f9;
      --pact-color-gray-900: #f8fafc;

      --pact-button-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
      --pact-button-shadow-hover: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
      --pact-input-shadow: inset 0 1px 2px 0 rgba(0, 0, 0, 0.3);
      --pact-card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
      --pact-modal-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);

      --pact-scrollbar-track: #1e293b;
      --pact-scrollbar-thumb: #475569;
      --pact-scrollbar-thumb-hover: #64748b;
    }

    /* Auto theme based on system preference */
    :host([theme="auto"]) {
      @media (prefers-color-scheme: light) {
        --pact-color-bg-primary: #ffffff;
        --pact-color-bg-secondary: #f8fafc;
        --pact-color-bg-tertiary: #f1f5f9;
        --pact-color-bg-overlay: rgba(0, 0, 0, 0.5);

        --pact-color-text-primary: #0f172a;
        --pact-color-text-secondary: #64748b;
        --pact-color-text-tertiary: #94a3b8;
        --pact-color-text-inverse: #ffffff;

        --pact-color-border-primary: #e2e8f0;
        --pact-color-border-secondary: #cbd5e1;
        --pact-color-border-focus: #3b82f6;

        --pact-color-primary: #3b82f6;
        --pact-color-primary-hover: #2563eb;
        --pact-color-primary-light: #dbeafe;
        --pact-color-primary-dark: #1e40af;

        --pact-color-secondary: #8b5cf6;
        --pact-color-secondary-hover: #7c3aed;
        --pact-color-secondary-light: #ede9fe;
        --pact-color-secondary-dark: #5b21b6;

        --pact-color-success: #10b981;
        --pact-color-success-light: #d1fae5;
        --pact-color-success-dark: #047857;

        --pact-color-error: #ef4444;
        --pact-color-error-light: #fee2e2;
        --pact-color-error-dark: #b91c1c;

        --pact-color-warning: #f59e0b;
        --pact-color-warning-light: #fef3c7;
        --pact-color-warning-dark: #b45309;

        --pact-color-info: #3b82f6;
        --pact-color-info-light: #dbeafe;
        --pact-color-info-dark: #1e40af;

        --pact-color-gray-50: #f8fafc;
        --pact-color-gray-100: #f1f5f9;
        --pact-color-gray-200: #e2e8f0;
        --pact-color-gray-300: #cbd5e1;
        --pact-color-gray-400: #94a3b8;
        --pact-color-gray-500: #64748b;
        --pact-color-gray-600: #475569;
        --pact-color-gray-700: #334155;
        --pact-color-gray-800: #1e293b;
        --pact-color-gray-900: #0f172a;

        --pact-button-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --pact-button-shadow-hover: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        --pact-input-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --pact-card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        --pact-modal-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

        --pact-scrollbar-track: #f1f5f9;
        --pact-scrollbar-thumb: #cbd5e1;
        --pact-scrollbar-thumb-hover: #94a3b8;
      }
      @media (prefers-color-scheme: dark) {
        --pact-color-bg-primary: #0f172a;
        --pact-color-bg-secondary: #1e293b;
        --pact-color-bg-tertiary: #334155;
        --pact-color-bg-overlay: rgba(0, 0, 0, 0.7);

        --pact-color-text-primary: #f8fafc;
        --pact-color-text-secondary: #cbd5e1;
        --pact-color-text-tertiary: #94a3b8;
        --pact-color-text-inverse: #0f172a;

        --pact-color-border-primary: #334155;
        --pact-color-border-secondary: #475569;
        --pact-color-border-focus: #3b82f6;

        --pact-color-primary: #3b82f6;
        --pact-color-primary-hover: #60a5fa;
        --pact-color-primary-light: #1e3a8a;
        --pact-color-primary-dark: #2563eb;

        --pact-color-secondary: #8b5cf6;
        --pact-color-secondary-hover: #a78bfa;
        --pact-color-secondary-light: #4c1d95;
        --pact-color-secondary-dark: #7c3aed;

        --pact-color-success: #10b981;
        --pact-color-success-light: #064e3b;
        --pact-color-success-dark: #34d399;

        --pact-color-error: #ef4444;
        --pact-color-error-light: #7f1d1d;
        --pact-color-error-dark: #f87171;

        --pact-color-warning: #f59e0b;
        --pact-color-warning-light: #78350f;
        --pact-color-warning-dark: #fbbf24;

        --pact-color-info: #3b82f6;
        --pact-color-info-light: #1e3a8a;
        --pact-color-info-dark: #60a5fa;

        --pact-color-gray-50: #0f172a;
        --pact-color-gray-100: #1e293b;
        --pact-color-gray-200: #334155;
        --pact-color-gray-300: #475569;
        --pact-color-gray-400: #64748b;
        --pact-color-gray-500: #94a3b8;
        --pact-color-gray-600: #cbd5e1;
        --pact-color-gray-700: #e2e8f0;
        --pact-color-gray-800: #f1f5f9;
        --pact-color-gray-900: #f8fafc;

        --pact-button-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
        --pact-button-shadow-hover: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
        --pact-input-shadow: inset 0 1px 2px 0 rgba(0, 0, 0, 0.3);
        --pact-card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
        --pact-modal-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);

        --pact-scrollbar-track: #1e293b;
        --pact-scrollbar-thumb: #475569;
        --pact-scrollbar-thumb-hover: #64748b;
      }
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    // Detect system theme if auto
    if (this.theme === 'auto') {
      this.detectSystemTheme();
    }
  }

  private detectSystemTheme() {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', () => {
      this.requestUpdate();
    });
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pact-theme-provider': PactThemeProvider;
  }
}
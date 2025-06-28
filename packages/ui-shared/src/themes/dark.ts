import { css } from 'lit';

export const darkTheme = css`
  :host {
    /* Background colors */
    --pact-color-bg-primary: #0f172a;
    --pact-color-bg-secondary: #1e293b;
    --pact-color-bg-tertiary: #334155;
    --pact-color-bg-overlay: rgba(0, 0, 0, 0.7);

    /* Text colors */
    --pact-color-text-primary: #f8fafc;
    --pact-color-text-secondary: #cbd5e1;
    --pact-color-text-tertiary: #94a3b8;
    --pact-color-text-inverse: #0f172a;

    /* Border colors */
    --pact-color-border-primary: #334155;
    --pact-color-border-secondary: #475569;
    --pact-color-border-focus: #3b82f6;

    /* Brand colors */
    --pact-color-primary: #3b82f6;
    --pact-color-primary-hover: #60a5fa;
    --pact-color-primary-light: #1e3a8a;
    --pact-color-primary-dark: #2563eb;

    --pact-color-secondary: #8b5cf6;
    --pact-color-secondary-hover: #a78bfa;
    --pact-color-secondary-light: #4c1d95;
    --pact-color-secondary-dark: #7c3aed;

    /* Semantic colors */
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

    /* Neutral colors */
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

    /* Component specific */
    --pact-button-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
    --pact-button-shadow-hover: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
    --pact-input-shadow: inset 0 1px 2px 0 rgba(0, 0, 0, 0.3);
    --pact-card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
    --pact-modal-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);

    /* Scrollbar */
    --pact-scrollbar-track: #1e293b;
    --pact-scrollbar-thumb: #475569;
    --pact-scrollbar-thumb-hover: #64748b;
  }
`;
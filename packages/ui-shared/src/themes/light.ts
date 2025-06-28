import { css } from 'lit';

export const lightTheme = css`
  :host {
    /* Background colors */
    --pact-color-bg-primary: #ffffff;
    --pact-color-bg-secondary: #f8fafc;
    --pact-color-bg-tertiary: #f1f5f9;
    --pact-color-bg-overlay: rgba(0, 0, 0, 0.5);

    /* Text colors */
    --pact-color-text-primary: #0f172a;
    --pact-color-text-secondary: #64748b;
    --pact-color-text-tertiary: #94a3b8;
    --pact-color-text-inverse: #ffffff;

    /* Border colors */
    --pact-color-border-primary: #e2e8f0;
    --pact-color-border-secondary: #cbd5e1;
    --pact-color-border-focus: #3b82f6;

    /* Brand colors */
    --pact-color-primary: #3b82f6;
    --pact-color-primary-hover: #2563eb;
    --pact-color-primary-light: #dbeafe;
    --pact-color-primary-dark: #1e40af;

    --pact-color-secondary: #8b5cf6;
    --pact-color-secondary-hover: #7c3aed;
    --pact-color-secondary-light: #ede9fe;
    --pact-color-secondary-dark: #5b21b6;

    /* Semantic colors */
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

    /* Neutral colors */
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

    /* Component specific */
    --pact-button-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --pact-button-shadow-hover: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    --pact-input-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --pact-card-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    --pact-modal-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

    /* Scrollbar */
    --pact-scrollbar-track: #f1f5f9;
    --pact-scrollbar-thumb: #cbd5e1;
    --pact-scrollbar-thumb-hover: #94a3b8;
  }
`;
import { css } from 'lit';

export const baseStyles = css`
  :host {
    /* Spacing - More compact */
    --pact-spacing-xs: 0.125rem;  /* 2px */
    --pact-spacing-sm: 0.25rem;   /* 4px */
    --pact-spacing-md: 0.5rem;    /* 8px */
    --pact-spacing-lg: 0.75rem;   /* 12px */
    --pact-spacing-xl: 1rem;      /* 16px */
    --pact-spacing-2xl: 1.5rem;   /* 24px */

    /* Typography - Slightly smaller */
    --pact-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    --pact-font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    --pact-font-size-xs: 0.6875rem;   /* 11px */
    --pact-font-size-sm: 0.8125rem;   /* 13px */
    --pact-font-size-base: 0.875rem;  /* 14px */
    --pact-font-size-lg: 1rem;        /* 16px */
    --pact-font-size-xl: 1.125rem;    /* 18px */
    --pact-font-size-2xl: 1.25rem;    /* 20px */
    --pact-font-weight-normal: 400;
    --pact-font-weight-medium: 500;
    --pact-font-weight-semibold: 600;
    --pact-font-weight-bold: 700;
    --pact-line-height-tight: 1.25;
    --pact-line-height-normal: 1.5;
    --pact-line-height-relaxed: 1.75;

    /* Borders */
    --pact-border-width: 1px;
    --pact-border-radius-sm: 0.375rem;
    --pact-border-radius-base: 0.5rem;
    --pact-border-radius-lg: 0.75rem;
    --pact-border-radius-xl: 1rem;
    --pact-border-radius-full: 9999px;

    /* Shadows */
    --pact-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --pact-shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    --pact-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --pact-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    --pact-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

    /* Transitions */
    --pact-transition-fast: 150ms;
    --pact-transition-base: 200ms;
    --pact-transition-slow: 300ms;
    --pact-transition-timing: cubic-bezier(0.4, 0, 0.2, 1);

    /* Z-index */
    --pact-z-index-base: 1;
    --pact-z-index-dropdown: 1000;
    --pact-z-index-sticky: 1020;
    --pact-z-index-fixed: 1030;
    --pact-z-index-modal-backdrop: 1040;
    --pact-z-index-modal: 1050;
    --pact-z-index-popover: 1060;
    --pact-z-index-tooltip: 1070;

    font-family: var(--pact-font-family);
    font-size: var(--pact-font-size-base);
    line-height: var(--pact-line-height-normal);
    font-weight: var(--pact-font-weight-normal);
    color: var(--pact-color-text-primary);
    background-color: var(--pact-color-bg-primary);
    box-sizing: border-box;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    font-weight: var(--pact-font-weight-semibold);
    line-height: var(--pact-line-height-tight);
  }

  h1 { font-size: var(--pact-font-size-2xl); }
  h2 { font-size: var(--pact-font-size-xl); }
  h3 { font-size: var(--pact-font-size-lg); }
  h4 { font-size: var(--pact-font-size-base); }
  h5 { font-size: var(--pact-font-size-sm); }
  h6 { font-size: var(--pact-font-size-xs); }

  p {
    margin: 0;
  }

  a {
    color: var(--pact-color-primary);
    text-decoration: none;
    transition: color var(--pact-transition-fast) var(--pact-transition-timing);
  }

  a:hover {
    color: var(--pact-color-primary-hover);
    text-decoration: underline;
  }

  code {
    font-family: var(--pact-font-family-mono);
    font-size: 0.875em;
    background: var(--pact-color-bg-secondary);
    padding: 0.125rem 0.25rem;
    border-radius: var(--pact-border-radius-sm);
  }

  pre {
    font-family: var(--pact-font-family-mono);
    font-size: var(--pact-font-size-sm);
    background: var(--pact-color-bg-secondary);
    padding: var(--pact-spacing-md);
    border-radius: var(--pact-border-radius-base);
    overflow-x: auto;
    margin: 0;
  }

  /* Utility Classes */
  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .text-xs { font-size: var(--pact-font-size-xs); }
  .text-sm { font-size: var(--pact-font-size-sm); }
  .text-base { font-size: var(--pact-font-size-base); }
  .text-lg { font-size: var(--pact-font-size-lg); }
  .text-xl { font-size: var(--pact-font-size-xl); }
  .text-2xl { font-size: var(--pact-font-size-2xl); }

  .font-normal { font-weight: var(--pact-font-weight-normal); }
  .font-medium { font-weight: var(--pact-font-weight-medium); }
  .font-semibold { font-weight: var(--pact-font-weight-semibold); }
  .font-bold { font-weight: var(--pact-font-weight-bold); }

  .text-primary { color: var(--pact-color-text-primary); }
  .text-secondary { color: var(--pact-color-text-secondary); }
  .text-success { color: var(--pact-color-success); }
  .text-error { color: var(--pact-color-error); }
  .text-warning { color: var(--pact-color-warning); }
  .text-info { color: var(--pact-color-info); }
`;
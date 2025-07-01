import { css, glob } from "goober";

// Initialize base CSS variables and resets
// These are the default values that themes will override
export function initializeGlobalStyles() {
  glob`
    :root {
      /* Spacing Scale - Comprehensive spacing system */
      --pact-spacing-0: 0;
      --pact-spacing-px: 1px;
      --pact-spacing-0_5: 0.125rem;     /* 2px */
      --pact-spacing-1: 0.25rem;        /* 4px */
      --pact-spacing-1_5: 0.375rem;     /* 6px */
      --pact-spacing-2: 0.5rem;         /* 8px */
      --pact-spacing-2_5: 0.625rem;     /* 10px */
      --pact-spacing-3: 0.75rem;        /* 12px */
      --pact-spacing-3_5: 0.875rem;     /* 14px */
      --pact-spacing-4: 1rem;           /* 16px */
      --pact-spacing-5: 1.25rem;        /* 20px */
      --pact-spacing-6: 1.5rem;         /* 24px */
      --pact-spacing-7: 1.75rem;        /* 28px */
      --pact-spacing-8: 2rem;           /* 32px */
      --pact-spacing-9: 2.25rem;        /* 36px */
      --pact-spacing-10: 2.5rem;        /* 40px */
      --pact-spacing-12: 3rem;          /* 48px */
      --pact-spacing-14: 3.5rem;        /* 56px */
      --pact-spacing-16: 4rem;          /* 64px */
      --pact-spacing-20: 5rem;          /* 80px */
      --pact-spacing-24: 6rem;          /* 96px */
      --pact-spacing-28: 7rem;          /* 112px */
      --pact-spacing-32: 8rem;          /* 128px */


      /* Typography System */
      --pact-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --pact-font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;

      /* Font sizes with consistent scale */
      --pact-font-size-2xs: 0.625rem;   /* 10px */
      --pact-font-size-xs: 0.75rem;     /* 12px */
      --pact-font-size-sm: 0.875rem;    /* 14px */
      --pact-font-size-base: 1rem;      /* 16px */
      --pact-font-size-lg: 1.125rem;    /* 18px */
      --pact-font-size-xl: 1.25rem;     /* 20px */
      --pact-font-size-2xl: 1.5rem;     /* 24px */
      --pact-font-size-3xl: 1.875rem;   /* 30px */
      --pact-font-size-4xl: 2.25rem;    /* 36px */
      --pact-font-size-5xl: 3rem;       /* 48px */
      --pact-font-size-6xl: 3.75rem;    /* 60px */
      --pact-font-size-7xl: 4.5rem;     /* 72px */
      --pact-font-size-8xl: 6rem;       /* 96px */
      --pact-font-size-9xl: 8rem;       /* 128px */

      /* Font weights */
      --pact-font-weight-thin: 100;
      --pact-font-weight-extralight: 200;
      --pact-font-weight-light: 300;
      --pact-font-weight-normal: 400;
      --pact-font-weight-medium: 500;
      --pact-font-weight-semibold: 600;
      --pact-font-weight-bold: 700;
      --pact-font-weight-extrabold: 800;
      --pact-font-weight-black: 900;

      /* Line heights */
      --pact-line-height-none: 1;
      --pact-line-height-tight: 1.25;
      --pact-line-height-snug: 1.375;
      --pact-line-height-normal: 1.5;
      --pact-line-height-relaxed: 1.625;
      --pact-line-height-loose: 2;

      /* Letter spacing */
      --pact-letter-spacing-tighter: -0.05em;
      --pact-letter-spacing-tight: -0.025em;
      --pact-letter-spacing-normal: 0em;
      --pact-letter-spacing-wide: 0.025em;
      --pact-letter-spacing-wider: 0.05em;
      --pact-letter-spacing-widest: 0.1em;

      /* Border widths */
      --pact-border-width-0: 0;
      --pact-border-width: 1px;
      --pact-border-width-2: 2px;
      --pact-border-width-4: 4px;
      --pact-border-width-8: 8px;

      /* Border radius - Modern, subtle curves */
      --pact-border-radius-none: 0;
      --pact-border-radius-sm: 0.25rem;      /* 4px */
      --pact-border-radius: 0.375rem;        /* 6px */
      --pact-border-radius-md: 0.5rem;       /* 8px */
      --pact-border-radius-lg: 0.625rem;     /* 10px */
      --pact-border-radius-xl: 0.75rem;      /* 12px */
      --pact-border-radius-2xl: 1rem;        /* 16px */
      --pact-border-radius-3xl: 1.25rem;     /* 20px */
      --pact-border-radius-full: 9999px;

      /* Box shadows */
      --pact-shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --pact-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
      --pact-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --pact-shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --pact-shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      --pact-shadow-xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      --pact-shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      --pact-shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
      --pact-shadow-none: 0 0 #0000;

      /* Drop shadow for filter property */
      --pact-drop-shadow-sm: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.05));
      --pact-drop-shadow: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1)) drop-shadow(0 1px 1px rgba(0, 0, 0, 0.06));
      --pact-drop-shadow-md: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.07)) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.06));
      --pact-drop-shadow-lg: drop-shadow(0 10px 8px rgba(0, 0, 0, 0.04)) drop-shadow(0 4px 3px rgba(0, 0, 0, 0.1));
      --pact-drop-shadow-xl: drop-shadow(0 20px 13px rgba(0, 0, 0, 0.03)) drop-shadow(0 8px 5px rgba(0, 0, 0, 0.08));
      --pact-drop-shadow-2xl: drop-shadow(0 25px 25px rgba(0, 0, 0, 0.15));
      --pact-drop-shadow-none: drop-shadow(0 0 #0000);

      /* Responsive Design Breakpoints */
      --pact-screen-sm: 640px;
      --pact-screen-md: 768px;
      --pact-screen-lg: 1024px;
      --pact-screen-xl: 1280px;
      --pact-screen-2xl: 1536px;

      /* Container max widths */
      --pact-container-sm: 640px;
      --pact-container-md: 768px;
      --pact-container-lg: 1024px;
      --pact-container-xl: 1280px;
      --pact-container-2xl: 1536px;

      /* Transitions */
      --pact-transition-fast: 150ms;
      --pact-transition-base: 200ms;
      --pact-transition-slow: 300ms;
      --pact-transition-timing: cubic-bezier(0.4, 0, 0.2, 1);

      /* Z-index layering system - Logical hierarchy for overlapping elements */
      --pact-z-index-base: 1;                    /* Base level for positioned elements */
      --pact-z-index-sticky: 100;                /* Sticky headers/footers */
      --pact-z-index-fixed: 200;                 /* Fixed positioned elements */
      --pact-z-index-dropdown: 300;              /* Dropdowns and select menus */
      --pact-z-index-overlay: 400;               /* General overlays */
      --pact-z-index-side-panel: 500;            /* Side panels and drawers */
      --pact-z-index-modal-backdrop: 600;        /* Modal backdrops */
      --pact-z-index-modal: 700;                 /* Modal dialogs */
      --pact-z-index-popover: 800;               /* Popovers and context menus */
      --pact-z-index-tooltip: 900;               /* Tooltips - always on top */
      --pact-z-index-toast: 1000;                /* Toast notifications - highest priority */
      --pact-z-index-dev-tools: 10000;           /* Dev tools and debuggers */
    }

    /* Basic CSS reset */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: var(--pact-font-family);
      font-size: var(--pact-font-size-base);
      line-height: var(--pact-line-height-normal);
      font-weight: var(--pact-font-weight-normal);
      color: var(--pact-color-text-primary);
      background-color: var(--pact-color-bg-primary);
    }

    /* Typography resets */
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

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--pact-scrollbar-track);
      border-radius: var(--pact-border-radius-full);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--pact-scrollbar-thumb);
      border-radius: var(--pact-border-radius-full);
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--pact-scrollbar-thumb-hover);
    }
  `;
}

// Common base styles that can be reused across components
export const baseStyles = css`
  font-family: var(--pact-font-family);
  font-size: var(--pact-font-size-base);
  line-height: var(--pact-line-height-normal);
  font-weight: var(--pact-font-weight-normal);
  color: var(--pact-color-text-primary);
  box-sizing: border-box;
`;

// Auto-initialize when module is imported
let initialized = false;
if (typeof window !== "undefined" && !initialized) {
  initialized = true;
  initializeGlobalStyles();
}

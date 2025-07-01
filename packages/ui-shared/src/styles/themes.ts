import { css } from 'goober';

// Light theme CSS variables - Modern developer tool aesthetic
export const lightTheme = css`
  /* Background colors - Cleaner, more subtle gradients */
  --pact-color-bg-primary: #ffffff;
  --pact-color-bg-secondary: #f8f9fb;
  --pact-color-bg-tertiary: #f3f4f6;
  --pact-color-bg-elevated: #ffffff;
  --pact-color-bg-accent: #fafbfc;
  --pact-color-bg-overlay: rgba(0, 0, 0, 0.4);
  --pact-color-bg-backdrop: rgba(248, 249, 251, 0.8);
  --pact-color-bg-code: #f6f8fa;
  --pact-color-bg-inverse: #24292e;

  /* Text colors - Better contrast ratios */
  --pact-color-text-primary: #0a0d14;
  --pact-color-text-secondary: #5a6373;
  --pact-color-text-tertiary: #8b95a7;
  --pact-color-text-muted: #a3acbb;
  --pact-color-text-inverse: #ffffff;
  --pact-color-text-link: #0969da;
  --pact-color-text-code: #0550ae;

  /* Border colors - Subtle and modern */
  --pact-color-border-primary: #e1e5eb;
  --pact-color-border-secondary: #d0d7de;
  --pact-color-border-tertiary: #c5cdd8;
  --pact-color-border-focus: #0969da;
  --pact-color-border-hover: #b1bac4;

  /* Primary brand colors - Professional blue */
  --pact-color-primary: #0969da;
  --pact-color-primary-hover: #0860ca;
  --pact-color-primary-active: #0757ba;
  --pact-color-primary-light: #e7f1ff;
  --pact-color-primary-lighter: #f3f8ff;
  --pact-color-primary-dark: #0550ae;

  /* Secondary accent colors - Modern purple */
  --pact-color-secondary: #8250df;
  --pact-color-secondary-hover: #7341d1;
  --pact-color-secondary-active: #6639ba;
  --pact-color-secondary-light: #f3f0ff;
  --pact-color-secondary-lighter: #fbfaff;
  --pact-color-secondary-dark: #6639ba;

  /* Success colors - Fresh green */
  --pact-color-success: #1a7f37;
  --pact-color-success-hover: #187733;
  --pact-color-success-active: #166e2f;
  --pact-color-success-light: #d1f8e0;
  --pact-color-success-lighter: #e6ffec;
  --pact-color-success-dark: #116329;

  /* Error colors - Dimmed red */
  --pact-color-error: #dc2626;
  --pact-color-error-hover: #b91c1c;
  --pact-color-error-active: #991b1b;
  --pact-color-error-light: #fef2f2;
  --pact-color-error-lighter: #fef0f0;
  --pact-color-error-dark: #7f1d1d;

  /* Warning colors - Warm amber */
  --pact-color-warning: #bf8700;
  --pact-color-warning-hover: #ae7c00;
  --pact-color-warning-active: #9e6f00;
  --pact-color-warning-light: #fff2c5;
  --pact-color-warning-lighter: #fffbe6;
  --pact-color-warning-dark: #8a6200;

  /* Info colors - Cool cyan */
  --pact-color-info: #0969da;
  --pact-color-info-hover: #0860ca;
  --pact-color-info-active: #0757ba;
  --pact-color-info-light: #e7f1ff;
  --pact-color-info-lighter: #f3f8ff;
  --pact-color-info-dark: #0550ae;

  /* Neutral gray scale - More nuanced */
  --pact-color-gray-50: #f9fafb;
  --pact-color-gray-100: #f3f4f6;
  --pact-color-gray-200: #e5e7eb;
  --pact-color-gray-300: #d1d5db;
  --pact-color-gray-400: #9ca3af;
  --pact-color-gray-500: #6b7280;
  --pact-color-gray-600: #4b5563;
  --pact-color-gray-700: #374151;
  --pact-color-gray-800: #1f2937;
  --pact-color-gray-900: #111827;

  /* Modern shadows - Subtle and layered */
  --pact-button-shadow: 0 1px 2px rgba(27, 31, 35, 0.04), 0 0 0 1px rgba(27, 31, 35, 0.04);
  --pact-button-shadow-hover: 0 2px 4px rgba(27, 31, 35, 0.08), 0 0 0 1px rgba(27, 31, 35, 0.06);
  --pact-button-shadow-active: inset 0 1px 2px rgba(27, 31, 35, 0.08);
  --pact-input-shadow: inset 0 1px 2px rgba(27, 31, 35, 0.075);
  --pact-input-shadow-focus: 0 0 0 3px rgba(9, 105, 218, 0.15);
  --pact-card-shadow: 0 1px 3px rgba(27, 31, 35, 0.04), 0 8px 24px rgba(66, 74, 83, 0.06);
  --pact-card-shadow-hover: 0 2px 8px rgba(27, 31, 35, 0.08), 0 12px 28px rgba(66, 74, 83, 0.08);
  --pact-modal-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  --pact-dropdown-shadow: 0 8px 16px rgba(0, 0, 0, 0.08), 0 0 1px rgba(27, 31, 35, 0.12);
  --pact-tooltip-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);

  /* Scrollbar styling */
  --pact-scrollbar-track: #f3f4f6;
  --pact-scrollbar-thumb: #d1d5db;
  --pact-scrollbar-thumb-hover: #9ca3af;

  /* Focus ring */
  --pact-focus-ring: 0 0 0 2px #ffffff, 0 0 0 4px #0969da;
  --pact-focus-ring-error: 0 0 0 2px #ffffff, 0 0 0 4px #d1242f;

  /* Interactive states */
  --pact-focus-color: #0969da;
  --pact-active-scale: 0.98;
  --pact-hover-opacity: 0.8;
  --pact-disabled-opacity: 0.5;

  /* Glassmorphism effects */
  --pact-glass-bg: rgba(255, 255, 255, 0.7);
  --pact-glass-border: rgba(255, 255, 255, 0.3);
  --pact-glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
`;

// Dark theme CSS variables - Modern developer tool aesthetic
export const darkTheme = css`
  /* Background colors - Rich dark tones */
  --pact-color-bg-primary: #0d1117;
  --pact-color-bg-secondary: #161b22;
  --pact-color-bg-tertiary: #21262d;
  --pact-color-bg-elevated: #1c2128;
  --pact-color-bg-accent: #0d1117;
  --pact-color-bg-overlay: rgba(0, 0, 0, 0.7);
  --pact-color-bg-backdrop: rgba(13, 17, 23, 0.8);
  --pact-color-bg-code: #161b22;
  --pact-color-bg-inverse: #e6edf3;

  /* Text colors - Optimal dark mode contrast */
  --pact-color-text-primary: #e6edf3;
  --pact-color-text-secondary: #8b949e;
  --pact-color-text-tertiary: #6e7681;
  --pact-color-text-muted: #484f58;
  --pact-color-text-inverse: #0d1117;
  --pact-color-text-link: #58a6ff;
  --pact-color-text-code: #79c0ff;

  /* Border colors - Subtle dark borders */
  --pact-color-border-primary: #30363d;
  --pact-color-border-secondary: #3d444d;
  --pact-color-border-tertiary: #484f58;
  --pact-color-border-focus: #1f6feb;
  --pact-color-border-hover: #6e7681;

  /* Primary brand colors - Vibrant blue */
  --pact-color-primary: #1f6feb;
  --pact-color-primary-hover: #388bfd;
  --pact-color-primary-active: #58a6ff;
  --pact-color-primary-light: #0c2d6b;
  --pact-color-primary-lighter: #0a2347;
  --pact-color-primary-dark: #1158c7;

  /* Secondary accent colors - Electric purple */
  --pact-color-secondary: #a371f7;
  --pact-color-secondary-hover: #b083ff;
  --pact-color-secondary-active: #bc8cff;
  --pact-color-secondary-light: #2d1b69;
  --pact-color-secondary-lighter: #1f1147;
  --pact-color-secondary-dark: #8957e5;

  /* Success colors - Emerald green */
  --pact-color-success: #3fb950;
  --pact-color-success-hover: #56d364;
  --pact-color-success-active: #6add7a;
  --pact-color-success-light: #0e3a16;
  --pact-color-success-lighter: #0a2e11;
  --pact-color-success-dark: #2ea043;

  /* Error colors - Dimmed warm red */
  --pact-color-error: #ef4444;
  --pact-color-error-hover: #dc2626;
  --pact-color-error-active: #b91c1c;
  --pact-color-error-light: #450a0a;
  --pact-color-error-lighter: #2d0a0a;
  --pact-color-error-dark: #7f1d1d;

  /* Warning colors - Golden amber */
  --pact-color-warning: #d29922;
  --pact-color-warning-hover: #e3b341;
  --pact-color-warning-active: #f0c452;
  --pact-color-warning-light: #3b2a14;
  --pact-color-warning-lighter: #2c1f0d;
  --pact-color-warning-dark: #bb8009;

  /* Info colors - Sky blue */
  --pact-color-info: #58a6ff;
  --pact-color-info-hover: #79b8ff;
  --pact-color-info-active: #8cc5ff;
  --pact-color-info-light: #0c2d6b;
  --pact-color-info-lighter: #0a2347;
  --pact-color-info-dark: #388bfd;

  /* Neutral gray scale - Optimized for dark mode */
  --pact-color-gray-50: #0d1117;
  --pact-color-gray-100: #161b22;
  --pact-color-gray-200: #21262d;
  --pact-color-gray-300: #30363d;
  --pact-color-gray-400: #484f58;
  --pact-color-gray-500: #6e7681;
  --pact-color-gray-600: #8b949e;
  --pact-color-gray-700: #b1bac4;
  --pact-color-gray-800: #c9d1d9;
  --pact-color-gray-900: #e6edf3;

  /* Modern shadows - Deep and subtle */
  --pact-button-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05);
  --pact-button-shadow-hover: 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08);
  --pact-button-shadow-active: inset 0 1px 3px rgba(0, 0, 0, 0.3);
  --pact-input-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  --pact-input-shadow-focus: 0 0 0 3px rgba(31, 111, 235, 0.25);
  --pact-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15);
  --pact-card-shadow-hover: 0 2px 8px rgba(0, 0, 0, 0.25), 0 12px 28px rgba(0, 0, 0, 0.2);
  --pact-modal-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
  --pact-dropdown-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.05);
  --pact-tooltip-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);

  /* Scrollbar styling */
  --pact-scrollbar-track: #161b22;
  --pact-scrollbar-thumb: #484f58;
  --pact-scrollbar-thumb-hover: #6e7681;

  /* Focus ring */
  --pact-focus-ring: 0 0 0 2px #0d1117, 0 0 0 4px #1f6feb;
  --pact-focus-ring-error: 0 0 0 2px #0d1117, 0 0 0 4px #f85149;

  /* Interactive states */
  --pact-focus-color: #1f6feb;
  --pact-active-scale: 0.98;
  --pact-hover-opacity: 0.8;
  --pact-disabled-opacity: 0.5;

  /* Glassmorphism effects */
  --pact-glass-bg: rgba(22, 27, 34, 0.7);
  --pact-glass-border: rgba(48, 54, 61, 0.5);
  --pact-glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
`;
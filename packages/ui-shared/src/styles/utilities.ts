import { css } from 'goober';

// Text utilities
export const truncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const srOnly = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`;

// Text size utilities
export const textXs = css`font-size: var(--pact-font-size-xs);`;
export const textSm = css`font-size: var(--pact-font-size-sm);`;
export const textBase = css`font-size: var(--pact-font-size-base);`;
export const textLg = css`font-size: var(--pact-font-size-lg);`;
export const textXl = css`font-size: var(--pact-font-size-xl);`;
export const text2xl = css`font-size: var(--pact-font-size-2xl);`;
export const text3xl = css`font-size: var(--pact-font-size-3xl);`;
export const text4xl = css`font-size: var(--pact-font-size-4xl);`;
export const text5xl = css`font-size: var(--pact-font-size-5xl);`;

// Font weight utilities
export const fontThin = css`font-weight: var(--pact-font-weight-thin);`;
export const fontExtralight = css`font-weight: var(--pact-font-weight-extralight);`;
export const fontLight = css`font-weight: var(--pact-font-weight-light);`;
export const fontNormal = css`font-weight: var(--pact-font-weight-normal);`;
export const fontMedium = css`font-weight: var(--pact-font-weight-medium);`;
export const fontSemibold = css`font-weight: var(--pact-font-weight-semibold);`;
export const fontBold = css`font-weight: var(--pact-font-weight-bold);`;
export const fontExtrabold = css`font-weight: var(--pact-font-weight-extrabold);`;
export const fontBlack = css`font-weight: var(--pact-font-weight-black);`;

// Text color utilities
export const textPrimary = css`color: var(--pact-color-text-primary);`;
export const textSecondary = css`color: var(--pact-color-text-secondary);`;
export const textTertiary = css`color: var(--pact-color-text-tertiary);`;
export const textInverse = css`color: var(--pact-color-text-inverse);`;
export const textSuccess = css`color: var(--pact-color-success);`;
export const textError = css`color: var(--pact-color-error);`;
export const textWarning = css`color: var(--pact-color-warning);`;
export const textInfo = css`color: var(--pact-color-info);`;

// Background color utilities
export const bgPrimary = css`background-color: var(--pact-color-bg-primary);`;
export const bgSecondary = css`background-color: var(--pact-color-bg-secondary);`;
export const bgTertiary = css`background-color: var(--pact-color-bg-tertiary);`;
export const bgOverlay = css`background-color: var(--pact-color-bg-overlay);`;

// Border utilities
export const borderNone = css`border: none;`;
export const border = css`border: var(--pact-border-width) solid var(--pact-color-border-primary);`;
export const borderTop = css`border-top: var(--pact-border-width) solid var(--pact-color-border-primary);`;
export const borderRight = css`border-right: var(--pact-border-width) solid var(--pact-color-border-primary);`;
export const borderBottom = css`border-bottom: var(--pact-border-width) solid var(--pact-color-border-primary);`;
export const borderLeft = css`border-left: var(--pact-border-width) solid var(--pact-color-border-primary);`;

// Border radius utilities
export const roundedNone = css`border-radius: var(--pact-border-radius-none);`;
export const roundedSm = css`border-radius: var(--pact-border-radius-sm);`;
export const rounded = css`border-radius: var(--pact-border-radius);`;
export const roundedMd = css`border-radius: var(--pact-border-radius-md);`;
export const roundedLg = css`border-radius: var(--pact-border-radius-lg);`;
export const roundedXl = css`border-radius: var(--pact-border-radius-xl);`;
export const rounded2xl = css`border-radius: var(--pact-border-radius-2xl);`;
export const rounded3xl = css`border-radius: var(--pact-border-radius-3xl);`;
export const roundedFull = css`border-radius: var(--pact-border-radius-full);`;

// Shadow utilities
export const shadowNone = css`box-shadow: var(--pact-shadow-none);`;
export const shadowXs = css`box-shadow: var(--pact-shadow-xs);`;
export const shadowSm = css`box-shadow: var(--pact-shadow-sm);`;
export const shadow = css`box-shadow: var(--pact-shadow);`;
export const shadowMd = css`box-shadow: var(--pact-shadow-md);`;
export const shadowLg = css`box-shadow: var(--pact-shadow-lg);`;
export const shadowXl = css`box-shadow: var(--pact-shadow-xl);`;
export const shadow2xl = css`box-shadow: var(--pact-shadow-2xl);`;
export const shadowInner = css`box-shadow: var(--pact-shadow-inner);`;

// Spacing utilities (padding/margin)
export const p0 = css`padding: var(--pact-spacing-0);`;
export const p1 = css`padding: var(--pact-spacing-1);`;
export const p2 = css`padding: var(--pact-spacing-2);`;
export const p3 = css`padding: var(--pact-spacing-3);`;
export const p4 = css`padding: var(--pact-spacing-4);`;
export const p5 = css`padding: var(--pact-spacing-5);`;
export const p6 = css`padding: var(--pact-spacing-6);`;
export const p8 = css`padding: var(--pact-spacing-8);`;

export const m0 = css`margin: var(--pact-spacing-0);`;
export const m1 = css`margin: var(--pact-spacing-1);`;
export const m2 = css`margin: var(--pact-spacing-2);`;
export const m3 = css`margin: var(--pact-spacing-3);`;
export const m4 = css`margin: var(--pact-spacing-4);`;
export const m5 = css`margin: var(--pact-spacing-5);`;
export const m6 = css`margin: var(--pact-spacing-6);`;
export const m8 = css`margin: var(--pact-spacing-8);`;

// Display utilities
export const block = css`display: block;`;
export const inlineBlock = css`display: inline-block;`;
export const inline = css`display: inline;`;
export const flex = css`display: flex;`;
export const inlineFlex = css`display: inline-flex;`;
export const grid = css`display: grid;`;
export const hidden = css`display: none;`;

// Flex utilities
export const flexRow = css`flex-direction: row;`;
export const flexCol = css`flex-direction: column;`;
export const justifyStart = css`justify-content: flex-start;`;
export const justifyEnd = css`justify-content: flex-end;`;
export const justifyCenter = css`justify-content: center;`;
export const justifyBetween = css`justify-content: space-between;`;
export const justifyAround = css`justify-content: space-around;`;
export const itemsStart = css`align-items: flex-start;`;
export const itemsEnd = css`align-items: flex-end;`;
export const itemsCenter = css`align-items: center;`;
export const itemsBaseline = css`align-items: baseline;`;
export const itemsStretch = css`align-items: stretch;`;

// Width utilities
export const wFull = css`width: 100%;`;
export const wAuto = css`width: auto;`;
export const wMin = css`width: min-content;`;
export const wMax = css`width: max-content;`;

// Height utilities
export const hFull = css`height: 100%;`;
export const hAuto = css`height: auto;`;
export const hMin = css`height: min-content;`;
export const hMax = css`height: max-content;`;

// Cursor utilities
export const cursorPointer = css`cursor: pointer;`;
export const cursorNotAllowed = css`cursor: not-allowed;`;
export const cursorWait = css`cursor: wait;`;
export const cursorHelp = css`cursor: help;`;
import { LitElement } from 'lit';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Get the current theme from localStorage or system preference
 */
export function getCurrentTheme(): Theme {
  const stored = localStorage.getItem('pact-theme') as Theme;
  if (stored && ['light', 'dark', 'system'].includes(stored)) {
    return stored;
  }
  return 'system';
}

/**
 * Get the resolved theme (light or dark) based on the current theme setting
 */
export function getResolvedTheme(): 'light' | 'dark' {
  const theme = getCurrentTheme();
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Set the theme and save to localStorage
 */
export function setTheme(theme: Theme): void {
  localStorage.setItem('pact-theme', theme);
  applyTheme();
  
  // Dispatch event for components to react to theme change
  window.dispatchEvent(new CustomEvent('pact-theme-change', { detail: { theme } }));
}

/**
 * Apply the current theme to the document
 */
export function applyTheme(): void {
  const resolved = getResolvedTheme();
  document.documentElement.setAttribute('data-pact-theme', resolved);
}

/**
 * Initialize theme on page load
 */
export function initTheme(): void {
  applyTheme();
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getCurrentTheme() === 'system') {
      applyTheme();
    }
  });
}

/**
 * Base class that adds theme awareness to components
 * Extend this instead of LitElement for theme-aware components
 */
export class ThemeAwareLitElement extends LitElement {
  private _theme: 'light' | 'dark' = getResolvedTheme();
  private _mediaQuery?: MediaQueryList;

  get theme() {
    return this._theme;
  }

  override connectedCallback() {
    super.connectedCallback();
    this._handleThemeChange = this._handleThemeChange.bind(this);
    window.addEventListener('pact-theme-change', this._handleThemeChange);
    
    // Listen for system theme changes
    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._handleMediaQuery = this._handleMediaQuery.bind(this);
    this._mediaQuery.addEventListener('change', this._handleMediaQuery);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pact-theme-change', this._handleThemeChange);
    this._mediaQuery?.removeEventListener('change', this._handleMediaQuery);
  }

  private _handleThemeChange() {
    const newTheme = getResolvedTheme();
    if (newTheme !== this._theme) {
      this._theme = newTheme;
      this.requestUpdate();
    }
  }

  private _handleMediaQuery() {
    if (getCurrentTheme() === 'system') {
      this._handleThemeChange();
    }
  }
}
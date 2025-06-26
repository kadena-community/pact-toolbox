import { css } from 'lit';

/**
 * Maps the expected CSS variables to the ones defined in the theme provider
 * This ensures backward compatibility and consistent styling
 */
export const themeMapping = css`
  :host {
    /* Background colors */
    --pact-bg-primary: var(--pact-color-bg-primary);
    --pact-bg-secondary: var(--pact-color-bg-secondary);
    --pact-bg-tertiary: var(--pact-color-bg-tertiary);
    --pact-bg-overlay: var(--pact-color-bg-overlay);
    
    /* Text colors */
    --pact-text-primary: var(--pact-color-text-primary);
    --pact-text-secondary: var(--pact-color-text-secondary);
    --pact-text-tertiary: var(--pact-color-text-tertiary);
    
    /* Border colors */
    --pact-border-color: var(--pact-color-border-primary);
    --pact-border-focus: var(--pact-color-border-focus);
    
    /* Brand colors */
    --pact-brand-primary: var(--pact-color-primary);
    --pact-brand-primary-hover: var(--pact-color-primary-hover);
    
    /* Status colors */
    --pact-success: var(--pact-color-success);
    --pact-error: var(--pact-color-error);
    --pact-warning: var(--pact-color-warning);
    --pact-info: var(--pact-color-info);
    
    /* Additional variables */
    --pact-border-radius: var(--pact-border-radius-base);
    --pact-shadow-base: var(--pact-shadow-base);
  }
`;

/**
 * Common button styles for the dev wallet
 */
export const buttonStyles = css`
  .btn-primary {
    background-color: var(--pact-brand-primary);
    color: white;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: var(--pact-border-radius);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    font-size: inherit;
  }
  
  .btn-primary:hover {
    background-color: var(--pact-brand-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--pact-shadow-base);
  }
  
  .btn-primary:active {
    transform: translateY(0);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  
  .btn-secondary {
    background-color: transparent;
    color: var(--pact-text-primary);
    padding: 0.5rem 1rem;
    border: 1px solid var(--pact-border-color);
    border-radius: var(--pact-border-radius);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    font-size: inherit;
  }
  
  .btn-secondary:hover {
    background-color: var(--pact-bg-secondary);
    border-color: var(--pact-brand-primary);
  }
  
  .btn-secondary:active {
    transform: translateY(1px);
  }
  
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
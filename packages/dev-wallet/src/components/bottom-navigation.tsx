import type { Component, JSX } from 'solid-js';
import { For } from 'solid-js';
import { css } from 'goober';
import { clsx } from 'clsx';
import type { WalletScreen } from '../types';
import { walletActions } from '../stores/wallet-store';

interface BottomNavigationProps {
  currentScreen: WalletScreen;
}

interface NavItem {
  id: WalletScreen;
  label: string;
  icon: () => JSX.Element;
}

const navigationStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--pact-color-bg-secondary);
  border-top: 1px solid var(--pact-color-border-primary);
  padding: var(--pact-spacing-2) var(--pact-spacing-4);
  height: 72px;
  flex-shrink: 0;
  border-radius: 0 0 var(--pact-border-radius-xl) var(--pact-border-radius-xl);
`;

const navItemStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--pact-spacing-1);
  padding: var(--pact-spacing-2);
  border: none;
  background: transparent;
  color: var(--pact-color-text-tertiary);
  cursor: pointer;
  border-radius: var(--pact-border-radius-md);
  transition: all var(--pact-transition-base) var(--pact-transition-timing);
  flex: 1;
  max-width: 80px;

  &:hover {
    color: var(--pact-color-text-primary);
    background: var(--pact-color-bg-tertiary);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const navItemActiveStyles = css`
  color: var(--pact-color-primary);

  &:hover {
    color: var(--pact-color-primary);
  }
`;

const navLabelStyles = css`
  font-size: var(--pact-font-size-xs);
  font-weight: var(--pact-font-weight-medium);
`;

const iconStyles = css`
  width: 20px;
  height: 20px;
`;

// Icon components
const AccountsIcon = () => (
  <svg class={iconStyles} viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm0 2c-3.314 0-6 1.343-6 3v1a1 1 0 001 1h10a1 1 0 001-1v-1c0-1.657-2.686-3-6-3z" />
  </svg>
);

const TransactionsIcon = () => (
  <svg class={iconStyles} viewBox="0 0 20 20" fill="currentColor">
    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM3 16a1 1 0 011-1h12a1 1 0 011 1v1H3v-1z" />
  </svg>
);

const NetworksIcon = () => (
  <svg class={iconStyles} viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 009 4.5V4a6 6 0 00-4.668 4.027z" />
    <path d="M15.668 8.027A6 6 0 0011 4v.5A1.5 1.5 0 0012.5 6c.526 0 .988-.27 1.256-.679a6.012 6.012 0 011.912 2.706z" />
    <path d="M10 11a1 1 0 100-2 1 1 0 000 2zm-3.5 3.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm7 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg class={iconStyles} viewBox="0 0 20 20" fill="currentColor">
    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
  </svg>
);

export const BottomNavigation: Component<BottomNavigationProps> = (props) => {
  const navItems: NavItem[] = [
    { id: 'transactions', label: 'Transactions', icon: TransactionsIcon },
    { id: 'accounts', label: 'Accounts', icon: AccountsIcon },
    { id: 'networks', label: 'Networks', icon: NetworksIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleNavClick = (screen: WalletScreen) => {
    walletActions.setCurrentScreen(screen);
  };

  return (
    <nav class={navigationStyles}>
      <For each={navItems}>
        {(item) => (
          <button
            class={clsx(
              navItemStyles,
              props.currentScreen === item.id && navItemActiveStyles
            )}
            onClick={() => handleNavClick(item.id)}
            aria-label={`Navigate to ${item.label}`}
            aria-current={props.currentScreen === item.id ? 'page' : undefined}
          >
            {item.icon()}
            <span class={navLabelStyles}>{item.label}</span>
          </button>
        )}
      </For>
    </nav>
  );
};
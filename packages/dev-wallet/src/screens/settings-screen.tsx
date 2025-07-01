import type { Component } from 'solid-js';
import { css } from 'goober';
import { PactCard, PactSwitch, PactButton, useToast } from '@pact-toolbox/ui-shared';
import { walletState, walletActions, walletEventEmitter } from '../stores/wallet-store';
import type { DevWalletSettings } from '../types';

const screenStyles = css`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--pact-spacing-4);
  gap: var(--pact-spacing-3);
`;

const titleStyles = css`
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-text-primary);
  margin-bottom: var(--pact-spacing-2);
`;

const settingsListStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-3);
`;

const settingItemStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const settingLabelStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--pact-spacing-1);
`;

const labelStyles = css`
  font-weight: var(--pact-font-weight-medium);
  color: var(--pact-color-text-primary);
`;

const descriptionStyles = css`
  font-size: var(--pact-font-size-sm);
  color: var(--pact-color-text-secondary);
`;

const dangerZoneStyles = css`
  margin-top: auto;
  padding-top: var(--pact-spacing-4);
  border-top: 1px solid var(--pact-color-border-primary);
`;

const dangerTitleStyles = css`
  font-size: var(--pact-font-size-base);
  font-weight: var(--pact-font-weight-semibold);
  color: var(--pact-color-error);
  margin-bottom: var(--pact-spacing-3);
`;

const buttonGroupStyles = css`
  display: flex;
  gap: var(--pact-spacing-3);
`;

export const SettingsScreen: Component = () => {
  const toast = useToast();
  const handleSettingChange = (key: keyof DevWalletSettings, value: boolean) => {
    walletActions.updateSettings({ [key]: value });
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all wallet data? This action cannot be undone.')) {
      walletActions.clearAllData();
      toast.showToast({
        variant: "info",
        title: "Data cleared",
        message: "All wallet data has been cleared",
        duration: 3000
      });
    }
  };

  const handleExportData = () => {
    walletActions.exportData();
  };

  return (
    <div class={screenStyles}>
      <h2 class={titleStyles}>Settings</h2>

      <div class={settingsListStyles}>
        <PactCard>
          <div class={settingItemStyles}>
            <div class={settingLabelStyles}>
              <span class={labelStyles}>Auto-lock</span>
              <span class={descriptionStyles}>
                Automatically lock wallet after 5 minutes of inactivity
              </span>
            </div>
            <PactSwitch
              checked={walletState.settings.autoLock}
              onChange={(e) => handleSettingChange('autoLock', e.currentTarget.checked)}
            />
          </div>
        </PactCard>

        <PactCard>
          <div class={settingItemStyles}>
            <div class={settingLabelStyles}>
              <span class={labelStyles}>Show Test Networks</span>
              <span class={descriptionStyles}>
                Display test networks in the network selector
              </span>
            </div>
            <PactSwitch
              checked={walletState.settings.showTestNetworks}
              onChange={(e) => handleSettingChange('showTestNetworks', e.currentTarget.checked)}
            />
          </div>
        </PactCard>
      </div>

      <div class={dangerZoneStyles}>
        <h3 class={dangerTitleStyles}>Danger Zone</h3>
        <div class={buttonGroupStyles}>
          <PactButton
            variant="secondary"
            onClick={handleExportData}
          >
            Export Wallet Data
          </PactButton>
          <PactButton
            variant="danger"
            onClick={handleClearData}
          >
            Clear All Data
          </PactButton>
        </div>
      </div>
    </div>
  );
};
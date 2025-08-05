<template>
  <component :is="() => $slots.default?.(renderProps)" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Wallet, WalletAccount } from '@pact-toolbox/wallet-core';
import { createWalletButton } from '../headless/wallet-button';

interface Props {
  wallet: Wallet | null;
  account: WalletAccount | null;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  error?: Error | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onAddressClick?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  isConnecting: false,
  isDisconnecting: false,
  error: null,
});

// Compute render props
const renderProps = computed(() => {
  const state = {
    wallet: props.wallet,
    account: props.account,
    isConnecting: props.isConnecting,
    isDisconnecting: props.isDisconnecting,
    error: props.error,
  };

  const actions = {
    onConnect: props.onConnect,
    onDisconnect: props.onDisconnect,
    onAddressClick: props.onAddressClick,
    clearError: () => {}, // Parent should handle
  };

  return createWalletButton(state, actions);
});
</script>
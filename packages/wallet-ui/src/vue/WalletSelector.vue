<template>
  <component :is="() => $slots.default?.(renderProps)" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import type { WalletMetadata } from '@pact-toolbox/wallet-core';
import { createWalletSelector } from '../headless/wallet-selector';

interface Props {
  wallets: WalletMetadata[];
  loading?: boolean;
  error?: Error | null;
  onSelect?: (walletId: string) => void;
  onAutoConnect?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
});

// Create selector instance
const selector = createWalletSelector(props.onSelect, props.onAutoConnect);

// Watch props and update state
watch(() => props.wallets, (wallets) => {
  selector.actions.setWallets(wallets);
}, { immediate: true });

watch(() => props.loading, (loading) => {
  selector.actions.setLoading(loading);
}, { immediate: true });

watch(() => props.error, (error) => {
  selector.actions.setError(error);
}, { immediate: true });

// Compute render props
const renderProps = computed(() => selector.getRenderProps());
</script>
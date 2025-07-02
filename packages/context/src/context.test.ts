import { describe, it, expect, beforeEach } from 'vitest';
import { getStore, resetStore } from './store';
import { createConfig } from './config';
import { eventBus } from './events';
import type { MultiNetworkConfig, SerializableNetworkConfig } from './types';

describe('PactToolboxStore', () => {
  beforeEach(() => {
    resetStore();
    eventBus.removeAllListeners();
  });
  
  const getTestNetworks = (): MultiNetworkConfig => ({
    default: 'testnet',
    environment: 'test',
    configs: {
      testnet: {
        networkId: 'testnet',
        name: 'Testnet',
        type: 'chainweb',
        rpcUrl: 'https://api.testnet.chainweb.com',
        senderAccount: 'test-account',
        keyPairs: [],
        keysets: {},
        meta: {
          chainId: '1',
          gasLimit: 1000,
          gasPrice: 0.000001,
          ttl: 600,
        },
      },
      development: {
        networkId: 'development',
        name: 'DevNet',
        type: 'chainweb-devnet',
        rpcUrl: 'http://localhost:8080',
        senderAccount: 'dev-account',
        keyPairs: [],
        keysets: {},
        meta: {
          chainId: '0',
          gasLimit: 1000,
          gasPrice: 0.000001,
          ttl: 600,
        },
      },
    },
  });
  
  it('should initialize with config', () => {
    const testNetworks = getTestNetworks();
    const config = createConfig({
      networks: testNetworks,
    });
    
    const store = getStore(config);
    
    expect(store.networks).toEqual(testNetworks);
    expect(store.network?.networkId).toBe('testnet');
    expect(store.wallet).toBe(null);
    expect(store.isConnecting).toBe(false);
  });
  
  it('should switch networks', async () => {
    const testNetworks = getTestNetworks();
    const config = createConfig({
      networks: testNetworks,
    });
    
    const store = getStore(config);
    let emittedEvent: any = null;
    
    eventBus.on('network:changed', (event) => {
      emittedEvent = event;
    });
    
    await store.setNetwork('development');
    
    expect(store.network?.networkId).toBe('development');
    expect(emittedEvent).toEqual({
      network: testNetworks.configs.development,
      previous: testNetworks.configs.testnet,
    });
  });
  
  it('should add and remove networks', () => {
    const testNetworks = getTestNetworks();
    const config = createConfig({ networks: testNetworks });
    const store = getStore(config);
    
    expect(store.networks?.configs).toEqual(testNetworks.configs);
    
    const newNetwork: SerializableNetworkConfig = {
      networkId: 'mainnet',
      name: 'Mainnet',
      type: 'chainweb',
      rpcUrl: 'https://api.chainweb.com',
      senderAccount: 'main-account',
      keyPairs: [],
      keysets: {},
      meta: {
        chainId: '1',
        gasLimit: 1000,
        gasPrice: 0.000001,
        ttl: 600,
      },
    };
    
    store.addNetwork('mainnet', newNetwork);
    expect(store.networks?.configs.mainnet).toEqual(newNetwork);
    
    store.removeNetwork('testnet');
    expect(store.networks?.configs.testnet).toBeUndefined();
  });
  
  it('should emit wallet modal events', () => {
    const store = getStore(createConfig());
    let openEmitted = false;
    let closeEmitted = false;
    
    eventBus.on('wallet:modal:open', () => {
      openEmitted = true;
    });
    
    eventBus.on('wallet:modal:close', () => {
      closeEmitted = true;
    });
    
    store.openWalletModal();
    expect(store.isWalletModalOpen).toBe(true);
    expect(openEmitted).toBe(true);
    
    store.closeWalletModal();
    expect(store.isWalletModalOpen).toBe(false);
    expect(closeEmitted).toBe(true);
  });
  
  it('should detect environment', () => {
    const store = getStore(createConfig({
      autoDetectEnvironment: true,
    }));
    
    // In test environment, it should detect 'test'
    expect(store.environment).toBe('test');
  });
  
  it('should create client for network', () => {
    const config = createConfig({
      networks: getTestNetworks(),
    });
    
    const store = getStore(config);
    
    expect(store.client).toBeDefined();
    expect(store.clients.size).toBe(1);
    expect(store.clients.has('testnet')).toBe(true);
    
    const client = store.getClient();
    expect(client).toBeDefined();
  });
  
  it('should throw error when getting client without network', () => {
    const store = getStore(createConfig());
    
    expect(() => store.getClient()).toThrow('No network selected');
  });
});
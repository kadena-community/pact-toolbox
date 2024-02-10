import type {
  ChainwebLocalNetworkConfig,
  ChainwebNetworkConfig,
  DevNetworkConfig,
  GetRpcUrlParams,
  NetworkConfig,
  PactServerNetworkConfig,
  PactToolboxConfigObj,
} from './config';

export function isPactServerNetworkConfig(config: NetworkConfig): config is PactServerNetworkConfig {
  return config?.type === 'pact-server';
}

export function isDevNetworkConfig(config: NetworkConfig): config is DevNetworkConfig {
  return config?.type === 'chainweb-devnet';
}

export function isChainwebNetworkConfig(config: NetworkConfig): config is ChainwebNetworkConfig {
  return config?.type === 'chainweb';
}

export function isChainwebLocalNetworkConfig(config: NetworkConfig): config is ChainwebLocalNetworkConfig {
  return config?.type === 'chainweb-local';
}

export function isLocalNetwork(
  config: NetworkConfig,
): config is PactServerNetworkConfig | ChainwebLocalNetworkConfig | DevNetworkConfig {
  return (
    (config?.type === 'pact-server' || config?.type === 'chainweb-local' || config?.type === 'chainweb-devnet') &&
    !!config.autoStart
  );
}

export function getNetworkPort(networkConfig: NetworkConfig) {
  const defaultPort = 8080;
  if (isDevNetworkConfig(networkConfig)) {
    return (
      (networkConfig.onDemandMining ? networkConfig.proxyPort : networkConfig.containerConfig?.port) ?? defaultPort
    );
  }

  if (isChainwebLocalNetworkConfig(networkConfig)) {
    return networkConfig.proxyPort ?? defaultPort;
  }

  if (isPactServerNetworkConfig(networkConfig)) {
    return networkConfig.serverConfig?.port ?? defaultPort;
  }

  return defaultPort;
}

export function getNetworkRpcUrl(networkConfig: NetworkConfig) {
  const port = getNetworkPort(networkConfig);
  const rpcUrl = networkConfig.rpcUrl ?? `http://localhost:{port}`;
  return rpcUrl.replace(/{port}/g, port.toString());
}

export function createRpcUrlGetter(networkConfig: NetworkConfig): (params: GetRpcUrlParams) => string {
  const rpcUrl = getNetworkRpcUrl(networkConfig);
  return ({ networkId = networkConfig.networkId, chainId = networkConfig.chainId ?? '0' }) => {
    // rpcUrl could contain placeholders like {chainId} and {networkId}
    return rpcUrl.replace(/{networkId}|{chainId}/g, (match: string) => (match === '{networkId}' ? networkId : chainId));
  };
}

interface ChainwebRpcUrlTemplate extends GetRpcUrlParams {
  host?: string;
}
export function createChainwebRpcUrl({
  host = 'http://localhost:{port}',
  chainId = '{chainId}',
  networkId = '{networkId}',
}: ChainwebRpcUrlTemplate = {}) {
  return `${host}/chainweb/0.0/${networkId}/chain/${chainId}/pact`;
}

export function getCurrentNetworkConfig(config: PactToolboxConfigObj) {
  const networkName = config.defaultNetwork || 'local';
  return config.networks[networkName];
}

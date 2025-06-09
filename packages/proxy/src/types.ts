export interface PactToolboxNetworkApiLike {
  getNodeServiceUrl(): string;
  getMiningClientUrl(): string;
  hasOnDemandMining(): boolean;
  restart(): Promise<void>;
}

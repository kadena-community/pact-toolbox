export interface PactToolboxNetworkApiLike {
  getServiceUrl(): string;
  getOnDemandMiningUrl(): string;
  hasOnDemandMining(): boolean;
  restart(): Promise<void>;
}

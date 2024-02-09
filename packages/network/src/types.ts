export interface ProcessWrapper {
  stop: () => Promise<void>;
  id?: number | string;
}

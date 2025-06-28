declare module "@jest/transform" {
  export interface TransformedSource {
    code: string;
    map?: any;
  }

  export interface AsyncTransformer<TOptions = any> {
    canInstrument?: boolean;
    getCacheKey?: (sourceText: string, sourcePath: string, options: { configString: string }) => string;
    getCacheKeyAsync?: (sourceText: string, sourcePath: string, options: { configString: string }) => Promise<string>;
    process?: (sourceText: string, sourcePath: string, options: any) => TransformedSource | string;
    processAsync?: (sourceText: string, sourcePath: string, options: any) => Promise<TransformedSource>;
  }
}
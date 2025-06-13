// interface TransformOptions<TransformerConfig = unknown> {
//   supportsDynamicImport: boolean;
//   supportsExportNamespaceFrom: boolean;
//   /**
//    * The value is:
//    * - `false` if Jest runs without Node ESM flag `--experimental-vm-modules`
//    * - `true` if the file extension is defined in [extensionsToTreatAsEsm](Configuration.md#extensionstotreatasesm-arraystring)
//    * and Jest runs with Node ESM flag `--experimental-vm-modules`
//    *
//    * See more at https://jestjs.io/docs/next/ecmascript-modules
//    */
//   supportsStaticESM: boolean;
//   supportsTopLevelAwait: boolean;
//   instrument: boolean;
//   /** Cached file system which is used by `jest-runtime` to improve performance. */
//   cacheFS: Map<string, string>;
//   /** Jest configuration of currently running project. */
//   config: ProjectConfig;
//   /** Stringified version of the `config` - useful in cache busting. */
//   configString: string;
//   /** Transformer configuration passed through `transform` option by the user. */
//   transformerConfig: TransformerConfig;
// }

// type TransformedSource = {
//   code: string;
//   map?: RawSourceMap | string | null;
// };

// interface AsyncTransformer<TransformerConfig = unknown> {
//   canInstrument?: boolean;

//   getCacheKey?: (sourceText: string, sourcePath: string, options: TransformOptions<TransformerConfig>) => string;

//   getCacheKeyAsync?: (
//     sourceText: string,
//     sourcePath: string,
//     options: TransformOptions<TransformerConfig>,
//   ) => Promise<string>;

//   process?: (sourceText: string, sourcePath: string, options: TransformOptions<TransformerConfig>) => TransformedSource;

//   processAsync: (
//     sourceText: string,
//     sourcePath: string,
//     options: TransformOptions<TransformerConfig>,
//   ) => Promise<TransformedSource>;
// }

// type Transformer<TransformerConfig = unknown> =
//   | SyncTransformer<TransformerConfig>
//   | AsyncTransformer<TransformerConfig>;

// type TransformerCreator<X extends Transformer<TransformerConfig>, TransformerConfig = unknown> = (
//   transformerConfig?: TransformerConfig,
// ) => X;

// type TransformerFactory<X extends Transformer> = {
//   createTransformer: TransformerCreator<X>;
// };

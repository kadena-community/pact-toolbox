import { PactToolboxRuntime } from 'pact-toolbox';

export default async function (runtime: PactToolboxRuntime, args) {
  console.log('Hello, world!', args);
  console.log(runtime.getConfig());
}

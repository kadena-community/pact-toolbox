import { createRspackPlugin, RspackPluginInstance } from 'unplugin';

import { unpluginFactory } from '.';
import { Options } from './core/options';

export default createRspackPlugin(unpluginFactory) as (options?: Options) => RspackPluginInstance;

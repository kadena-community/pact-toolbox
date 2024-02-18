import { WebpackPluginInstance, createWebpackPlugin } from 'unplugin';
import { unpluginFactory } from '.';
import { Options } from './core/options';

export default createWebpackPlugin(unpluginFactory) as (options?: Options) => WebpackPluginInstance;

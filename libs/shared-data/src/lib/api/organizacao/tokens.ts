import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta da `uniplus-api` que serve o módulo Organização Institucional
 * (ex.: `http://localhost:5000` em dev local). Provido por
 * `provideRuntimeConfig()` a partir de `runtime-config.json`.
 */
export const ORGANIZACAO_BASE_PATH = new InjectionToken<string>('ORGANIZACAO_BASE_PATH');

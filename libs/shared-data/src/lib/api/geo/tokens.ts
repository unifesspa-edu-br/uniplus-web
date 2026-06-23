import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta da `uniplus-api` que serve o módulo Geo (`GET /api/cep/{cep}`
 * e `GET /api/cidades`). Em dev local resolve para o mesmo `apiUrl` do
 * runtime-config (ADR-0021); os módulos compartilham o gateway. Provido por
 * `provideRuntimeConfig()`.
 */
export const GEO_BASE_PATH = new InjectionToken<string>('GEO_BASE_PATH');

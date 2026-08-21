import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta do backend que serve o módulo Geo (`GET /api/cep/{cep}` e
 * `GET /api/cidades`). Resolve `runtime-config.json.geoApiUrl` (ADR-0021)
 * quando presente; cai no mesmo `apiUrl` dos demais módulos quando ausente —
 * cobre dev local, onde um único gateway proxeia `uniplus-api` e `geo-api`
 * sob a mesma origin. Em ambientes onde `geo-api` é deployable genuinamente
 * separado (host próprio, ex. HML), `geoApiUrl` precisa estar configurado —
 * sem ele, chamadas geo vão pro host errado (404 do Ingress, não CORS,
 * mesmo que o navegador relate como bloqueio de CORS). Provido por
 * `provideRuntimeConfig()`.
 */
export const GEO_BASE_PATH = new InjectionToken<string>('GEO_BASE_PATH');

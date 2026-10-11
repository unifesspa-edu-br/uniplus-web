import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta do gateway que serve a Portal API, o BFF público do portal do candidato
 * (ADR-0131 do `uniplus-api`). Os paths do contrato são absolutos a partir do origin
 * (`/api/portal/certames/{identificador}`); o gateway encaminha `/api/portal/*` à Portal API.
 */
export const PORTAL_BASE_PATH = new InjectionToken<string>('PORTAL_BASE_PATH');

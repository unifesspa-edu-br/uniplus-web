import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta da `uniplus-api` que serve o módulo Ingresso
 * (ex.: `http://localhost:5000` em dev local). Análogo a `SELECAO_BASE_PATH`
 * — provido uma vez por aplicação em `app.config.ts`.
 */
export const INGRESSO_BASE_PATH = new InjectionToken<string>('INGRESSO_BASE_PATH');

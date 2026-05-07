import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta da `uniplus-api` que serve o módulo Seleção
 * (ex.: `http://localhost:5000` em dev local; `https://api.uniplus.unifesspa.edu.br`
 * em produção). Os paths declarados pelo contrato V1 (ADR-0030 do `uniplus-api`)
 * são absolutos a partir do origin (`/api/editais`, etc.) — não inclua sufixo
 * `/api/v1` no valor provido.
 *
 * Provido uma vez por aplicação em `app.config.ts` a partir de
 * `environment.apiUrl`.
 */
export const SELECAO_BASE_PATH = new InjectionToken<string>('SELECAO_BASE_PATH');

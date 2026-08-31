import { InjectionToken } from '@angular/core';

/**
 * Origin absoluta da `uniplus-api` para chamadas ao módulo Publicações. É de lá
 * que vem o catálogo de tipos de ato, referenciado por qualquer fase do
 * cronograma que produza resultado.
 */
export const PUBLICACOES_BASE_PATH = new InjectionToken<string>('PUBLICACOES_BASE_PATH');

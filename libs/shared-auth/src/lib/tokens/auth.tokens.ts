import { InjectionToken } from '@angular/core';

/**
 * Lista de URLs (prefixos de origem) para as quais o `tokenInterceptor`
 * pode anexar o header `Authorization: Bearer <token>`.
 *
 * Qualquer requisição cuja URL não comece por nenhum dos prefixos
 * configurados NÃO recebe o Bearer, evitando vazamento de credenciais
 * para domínios externos (finding B2 do review da PR #3).
 *
 * Configurado pelo provider `provideAuth` a partir de `AuthConfig.allowedUrls`.
 */
export const AUTH_ALLOWED_URLS = new InjectionToken<readonly string[]>('AUTH_ALLOWED_URLS', {
  providedIn: 'root',
  factory: () => [],
});

import { InjectionToken } from '@angular/core';
import type { AuthConfig } from '../models/auth-config.model';

/**
 * Configuração de autenticação resolvida em runtime (ADR-0021). Provida
 * via factory de `provideRuntimeConfig()` (em `@uniplus/shared-data`)
 * que lê `/assets/runtime-config.json` antes do bootstrap das rotas.
 *
 * O consumer (`provideAuth`) lê este token sem args — desacopla
 * `shared-auth` de `shared-data` (apenas o token cruza a fronteira;
 * a fonte da config é responsabilidade do orquestrador).
 *
 * Não tem `providedIn: 'root'` por design — apps que não fizerem
 * `provideRuntimeConfig()` antes de `provideAuth()` falham com erro
 * claro de DI ao subir, e o fitness `runtime-config.fitness.spec.ts`
 * captura essa omissão no CI.
 */
export const AUTH_CONFIG = new InjectionToken<AuthConfig>('AUTH_CONFIG');

/**
 * Lista de URLs (prefixos de origem) para as quais o `tokenInterceptor`
 * pode anexar o header `Authorization: Bearer <token>`.
 *
 * Qualquer requisição cuja URL não comece por nenhum dos prefixos
 * configurados NÃO recebe o Bearer, evitando vazamento de credenciais
 * para domínios externos (finding B2 do review da PR #3).
 *
 * Derivado pelo `provideAuth` a partir de `AUTH_CONFIG.allowedUrls`.
 */
export const AUTH_ALLOWED_URLS = new InjectionToken<readonly string[]>('AUTH_ALLOWED_URLS', {
  providedIn: 'root',
  factory: () => [],
});

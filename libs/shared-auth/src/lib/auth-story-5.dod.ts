/**
 * Ficha de cobertura — Story uniplus-web#5 (autenticação Keycloak
 * completa). Documenta quais cenários compõem a Definition of Done
 * da Story e aponta para os arquivos que os cobrem em detalhe.
 *
 * Este arquivo NÃO é um spec — não é coletado pelo Vitest.
 * Não introduz lógica nova: apenas consolida o mapa entre critérios
 * de aceite e testes unitários para facilitar auditoria e revisão.
 */

interface DoDItem {
  id: string;
  description: string;
  coveredBy: readonly string[];
}

export const coverage: readonly DoDItem[] = [
  // --- Originais (review PR #3) -----------------------------------
  {
    id: 'allowlist',
    description: 'Token interceptor possui allowlist de URLs',
    coveredBy: ['interceptors/token.interceptor.spec.ts'],
  },
  {
    id: 'refresh-before-attach',
    description: 'Token interceptor chama refreshToken() antes de anexar',
    coveredBy: ['interceptors/token.interceptor.spec.ts'],
  },
  {
    id: 'provide-auth',
    description: 'provideAuth() chamado em cada app.config.ts',
    coveredBy: ['apps/*/src/app/app.config.ts (wiring)'],
  },
  {
    id: 'guards-routes',
    description: 'Rotas protegidas usam canActivate: [authGuard]',
    coveredBy: ['apps/*/src/app/app.routes.ts (wiring)', 'guards/auth.guard.spec.ts'],
  },
  {
    id: 'error-401-403',
    description: 'Error interceptor trata 401 (login) e 403 (acesso-negado)',
    coveredBy: ['interceptors/auth-error.interceptor.spec.ts'],
  },
  {
    id: 'init-resilience',
    description: 'auth.init() com try/catch e feedback se KC indisponível',
    coveredBy: ['services/auth.service.init.spec.ts', 'components/auth-error-banner.component.ts'],
  },
  {
    id: 'on-token-expired',
    description: 'onTokenExpired configurado para renovação automática',
    coveredBy: ['services/auth.service.init.spec.ts'],
  },
  {
    id: 'silent-check-sso',
    description: 'silent-check-sso.html criado nos assets das 3 apps',
    coveredBy: [
      'apps/selecao/public/assets/silent-check-sso.html',
      'apps/ingresso/public/assets/silent-check-sso.html',
      'apps/portal/public/assets/silent-check-sso.html',
    ],
  },
  {
    id: 'guards-tests',
    description: 'Testes unitários para tokenInterceptor, authGuard, roleGuard',
    coveredBy: [
      'interceptors/token.interceptor.spec.ts',
      'guards/auth.guard.spec.ts',
      'guards/role.guard.spec.ts',
    ],
  },
  // --- Hardening (uniplus-api#67) --------------------------------
  {
    id: 'h1-refresh-serialization',
    description: 'Chamadas concorrentes ao refreshToken são serializadas',
    coveredBy: ['services/auth.service.refresh.spec.ts'],
  },
  {
    id: 'h1-reuse-exceeded',
    description: 'Replay de refresh (reuse exceeded) dispara logout',
    coveredBy: ['services/auth.service.refresh.spec.ts'],
  },
  {
    id: 'h2-lockout-ui',
    description: 'Formulário distingue senha errada vs conta bloqueada',
    coveredBy: ['models/login-error.model.spec.ts', 'components/login-error-banner.component.ts'],
  },
  {
    id: 'h3-forbidden-role',
    description: 'roleGuard distingue não-autenticado (401) vs sem-role (403)',
    coveredBy: ['guards/role.guard.spec.ts'],
  },
  {
    id: 'normalized-usernames',
    description: 'Fixtures usam usernames normalizados (sem @teste)',
    coveredBy: ['(convenção aplicada em todos os *.spec.ts desta lib)'],
  },
] as const;

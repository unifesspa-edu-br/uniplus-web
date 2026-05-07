# `@uniplus/shared-e2e` — helpers compartilhados para E2E Playwright

Helpers reutilizáveis pelos `apps/*-e2e` do workspace. Atualmente foca em autenticação Keycloak (UI login + reset password admin + setup de `storageState` autenticado).

## API pública

### Login UI / admin

- `keycloakLogin(page, username, password)` — preenche o formulário do Keycloak, trata password update se temporária, espera redirect.
- `keycloakLogout(page)` — clica no botão "Sair" do header, espera redirect.
- `resetPasswords([{ username, password }])` — Admin API para resetar senhas em batch (idempotente, com retry de 500 do Hibernate).
- `expectUserInHeader(page, name, username, roles)` — assertion do header autenticado.

### Setup de `storageState` autenticado (F9)

- `setupKeycloakAuth(options)` — single-shot: reset de senha + login UI + persistência do `storageState` em disco. Invocado de dentro de um **setup project** Playwright (≥1.31) — não usar `globalSetup` para evitar exigir `KEYCLOAK_ADMIN_PASSWORD` em runs filtradas (`--project=chromium`) que não precisam de auth.
- `createGlobalSetup(options)` — wrapper para o uso canônico (`globalSetup: require.resolve('./src/global-setup')`). Mantido para compatibilidade com apps que precisam de globalSetup, mas o pattern preferido é o setup project descrito abaixo.

#### Padrão de uso por app E2E (setup project)

```ts
// apps/<app>-e2e/src/auth.setup.ts
import { test as setup } from '@playwright/test';
import * as path from 'node:path';
import { setupKeycloakAuth } from '@uniplus/shared-e2e';
import { ADMIN_USER, STORAGE_STATE_PATH_ADMIN } from './fixtures/auth.fixture';

setup('autentica admin via Keycloak e persiste storageState', async ({}, testInfo) => {
  const baseURL =
    testInfo.config.projects[0]?.use.baseURL ?? 'http://localhost:4200';

  await setupKeycloakAuth({
    // path.resolve ancora no app e2e — paths relativos cairiam no cwd
    // do runner Playwright (variável conforme invocação).
    storageStatePath: path.resolve(__dirname, '..', STORAGE_STATE_PATH_ADMIN),
    appBaseUrl: baseURL,
    username: ADMIN_USER.username,
    password: ADMIN_USER.password,
  });
});
```

```ts
// apps/<app>-e2e/playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts$/,
    },
    // ... projects de UI login (legados) com testIgnore para auth.setup.ts ...
    {
      name: '<app>-authenticated',
      testMatch: /.*\.authenticated\.spec\.ts/,
      dependencies: ['auth-setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE_PATH_ADMIN },
    },
  ],
});
```

Specs com sufixo `*.authenticated.spec.ts` rodam no project `*-authenticated` e abrem direto na app autenticada — sem login UI dentro do test. O `auth-setup` só roda quando algum project que declara `dependencies: ['auth-setup']` é selecionado, então `--project=chromium` sozinho NÃO dispara o setup nem exige `KEYCLOAK_ADMIN_PASSWORD`.

### Acessibilidade WCAG 2.1 A + AA

- `runAxeWcagAA(page, options?)` — executa `@axe-core/playwright` filtrado por tags WCAG 2.1 A + AA. Retorna `AxeResults`; caller asserta sobre `violations`.
- `WCAG_A_AA_TAGS` — constante `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']`.
- `RunAxeOptions` — `tags?` (override), `include?` (subtree), `exclude?` (selectors a suprimir).

#### Padrão de uso

```ts
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { test, expect } from '../fixtures/auth.fixture';

test('GET /editais sem violations a11y', async ({ page }) => {
  await page.goto('/editais');
  await expect(page.locator('h2', { hasText: 'Editais' })).toBeVisible();
  // SEMPRE aguardar estado estável antes de runAxeWcagAA — axe analisa
  // o DOM no momento da chamada; lazy-loaded ou em transição é perdido.

  const results = await runAxeWcagAA(page);
  expect(results.violations).toEqual([]);
});
```

Specs com sufixo `*.a11y.authenticated.spec.ts` (ou só `*.authenticated.spec.ts`) rodam no project `selecao-authenticated` — usam o mesmo `storageState` do setup project. Conformidade alvo: e-MAG 3.1 + WCAG 2.1 AA (autarquia federal — Lei 13.146/2015).

## Padrão #20 — JWT só em memória (importante)

O `storageState` do Playwright persiste **apenas cookies de sessão do Keycloak** no contexto do browser de teste. Quando o spec carrega a app, o `keycloak-angular` faz silent-SSO via iframe usando essas cookies e popula o JWT em memória do `KeycloakService`. **A invariante "JWT nunca em localStorage/sessionStorage" do código de produção continua valendo** — o storageState é mecanismo de isolamento de browser context apenas para test runs, não pattern de produção.

## Variáveis de ambiente

| Var | Default | Descrição |
|---|---|---|
| `KEYCLOAK_URL` | `http://localhost:8080` | Origin do Keycloak (Admin API + UI). |
| `KEYCLOAK_ADMIN` | `admin` | Usuário admin do realm `master` (Direct Access Grants). |
| `KEYCLOAK_ADMIN_PASSWORD` | — | **Obrigatório.** Sem isto, qualquer chamada a `resetPasswords` lança Error. |
| `BASE_URL` | `http://localhost:4200` | URL da app sob teste (passado para o Playwright). |

## Não-escopo

- **Token via password grant direto + injeção em localStorage** — incompatível com padrão #20 do projeto. O fluxo escolhido (login UI + storageState) preserva a invariante.
- **Logout entre tests no mesmo project** — o `storageState` é compartilhado; tests que precisam de logout devem rodar no project com login UI.
- **Multi-user storageState** — V1 só tem admin. Para roles diferentes (gestor, candidato, avaliador), criar projects adicionais com storageState próprios usando o mesmo pattern.

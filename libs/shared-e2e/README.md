# `@uniplus/shared-e2e` — helpers compartilhados para E2E Playwright

Helpers reutilizáveis pelos `apps/*-e2e` do workspace. Atualmente foca em autenticação Keycloak (UI login + reset password admin + setup de `storageState` autenticado).

## API pública

### Login UI / admin

- `keycloakLogin(page, username, password)` — preenche o formulário do Keycloak, trata password update se temporária, espera redirect.
- `keycloakLogout(page)` — clica no botão "Sair" do header, espera redirect.
- `resetPasswords([{ username, password }])` — Admin API para resetar senhas em batch (idempotente, com retry de 500 do Hibernate).
- `expectUserInHeader(page, name, username, roles)` — assertion do header autenticado.

### Setup de `storageState` autenticado (F9)

- `setupKeycloakAuth(options)` — single-shot: reset de senha + login UI + persistência do `storageState` em disco. Invocado a partir do `globalSetup` do Playwright.
- `createGlobalSetup(options)` — wrapper para o uso canônico (`globalSetup: require.resolve('./src/global-setup')`).

#### Padrão de uso por app E2E

```ts
// apps/<app>-e2e/src/global-setup.ts
import type { FullConfig } from '@playwright/test';
import * as path from 'node:path';
import { setupKeycloakAuth } from '@uniplus/shared-e2e';
import { ADMIN_USER, STORAGE_STATE_PATH_ADMIN } from './fixtures/auth.fixture';

export default async function globalSetup(config: FullConfig) {
  await setupKeycloakAuth({
    // path.resolve(__dirname, '..', ...) ancora no app e2e — o cwd do globalSetup
    // é o workspace root pelo preset Nx, então paths relativos cairiam fora.
    storageStatePath: path.resolve(__dirname, '..', STORAGE_STATE_PATH_ADMIN),
    appBaseUrl: config.projects[0]?.use.baseURL ?? 'http://localhost:4200',
    username: ADMIN_USER.username,
    password: ADMIN_USER.password,
  });
}
```

```ts
// apps/<app>-e2e/playwright.config.ts
export default defineConfig({
  globalSetup: require.resolve('./src/global-setup'),
  projects: [
    // ... projects de UI login (legados) ...
    {
      name: '<app>-authenticated',
      testMatch: /.*\.authenticated\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE_PATH_ADMIN },
    },
  ],
});
```

Specs com sufixo `*.authenticated.spec.ts` rodam no project `*-authenticated` e abrem direto na app autenticada — sem login UI dentro do test.

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

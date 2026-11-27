---
status: accepted
date: 2026-05-09
decision-makers:
  - 'Tech Lead'
consulted:
  - 'DevOps'
informed:
  - 'Equipe `uniplus-web`'
---

# ADR-0021: Runtime config via `AUTH_CONFIG` InjectionToken + testes de inicialização

> **Emenda (2026-11-25).** A conferência textual do app.config.ts deixa de existir. A ordem entre provideRuntimeConfig() e provideAuth() não tem efeito: a configuração é carregada e a autenticação é iniciada num único inicializador. Cada aplicativo prova por teste de comportamento que a inicialização carrega o runtime-config e inicia a autenticação com ele. A origem dos provedores é garantida pelo compilador e pela regra de pontos de entrada públicos.
>
> **Emenda (2026-11-17).** O alvo de teste do workspace é `test`, o canônico da ADR-0004; o alvo `vite:test` deixou de existir. Onde este texto cita `vite:test`, leia `test`.

## Contexto e enunciado do problema

A Story [#84](https://github.com/unifesspa-edu-br/uniplus-web/issues/84) exige que as 3 apps (`selecao`, `ingresso`, `portal`) carreguem URL da API e parâmetros OIDC em runtime, lidos de `/assets/runtime-config.json`, para que a **mesma imagem** Docker (publicada via [ADR-0020](0020-registry-ghcr-e-tagging.md)) seja promovida entre ambientes apenas trocando o `ConfigMap` montado pelo Kubernetes — sem rebuild, sem `fileReplacements` por ambiente, sem URL embutida no bundle.

A estratégia substituída usava `environment.prod.ts` com placeholders (`PLACEHOLDER_API_URL`, `PLACEHOLDER_OIDC_URL`) substituídos por `fileReplacements` no `project.json`. Isso quebra o invariante "imagem única por app" — a imagem hoje publicada pela ADR-0020 já contém os placeholders compilados, e mountar `ConfigMap` sobre `/assets/runtime-config.json` não muda o bundle Angular que lê `environment.*` em build time.

A pergunta operacional, que conduziu o debate desta ADR, foi: **como o `provideAuth()` da `shared-auth` deve consumir a `AppConfig` resolvida em runtime?** Há três opções concretas, com trade-offs distintos sobre acoplamento `shared-auth ↔ shared-data`, boilerplate por app, e proteção contra esquecimento silencioso.

## Drivers da decisão

- **Imagem única por app** (invariante da ADR-0020) — URL real só em `runtime-config.json`, montado por `ConfigMap`.
- **Idiomático Angular 21** — `InjectionToken` é o pattern oficial do framework para configuração injetável (vide `@angular/router`, `@angular/forms`).
- **Testabilidade** — config trivialmente mockável via `{ provide: TOKEN, useValue: stub }` no `TestBed`.
- **Desacoplamento** — `shared-auth` **não** deve conhecer `AppConfigService`; apenas o token cruza a fronteira.
- **Proteção cross-app contra esquecimento** — o pattern deve ser obrigatório por contrato testável, não por convenção que dev pode esquecer.
- **Boilerplate zero por app** — `app.config.ts` das 3 apps deve ficar mínimo; replicação para 4º app trivial.

## Opções consideradas

- **A — `provideAuth()` lê `AppConfigService` internamente.** Boilerplate zero. **Acoplamento `shared-auth → shared-data`** — viola separação de concerns e contraria a topologia futura discutida na ideia `frontend-libs-architecture` (`type:auth → type:core, type:util`, sem `type:data`).
- **B — `provideAuth(() => AuthConfig)` factory.** Boilerplate moderado, desacopla. Sem proteção arquitetural contra factory mal-construída — erro só aparece em runtime DI.
- **C — `AUTH_CONFIG` InjectionToken** + `provideRuntimeConfig()` provê o token via factory derivando de `AppConfigService`. **Boilerplate zero por app** + idiomático + desacoplado.
- **C + verificação cross-app** (escolhida) — testes de comportamento verificam a inicialização em cada aplicativo.

## Resultado da decisão

**Escolhida: "C + testes de comportamento da inicialização"**, porque é a única opção que combina:

1. **Pattern Angular canônico** — `InjectionToken<AuthConfig>` resolvido por factory que depende de `AppConfigService`. Zero magia oculta; cada peça aparece como provider explícito no DI tree.
2. **Boilerplate zero por app** — apps fazem apenas `provideRuntimeConfig() + provideAuth()`. O token e os `BASE_PATH` são providos pela própria `provideRuntimeConfig`, eliminando a duplicação que tornava C verboso na configuração tradicional.
3. **Testes garantem a inicialização cross-app** — cada aplicativo verifica o carregamento e a autenticação com a configuração recebida.
4. **Desacoplamento `shared-auth ↔ shared-data`** — `shared-auth` exporta apenas o token; `shared-data` (orquestrador de runtime) importa o token e provê via factory. Quando a topologia estrutural da ideia Compozy `frontend-libs-architecture` (Onda 1) chegar e demote `shared-data` para `@nx/js:tsc`, o token continua válido — só a factory muda.

### Forma da implementação

**`shared-auth/lib/tokens/auth.tokens.ts`:**

```ts
export const AUTH_CONFIG = new InjectionToken<AuthConfig>('AUTH_CONFIG');
```

Sem `providedIn: 'root'` por design — apps que esquecem `provideRuntimeConfig()` falham com erro DI claro (e o teste de comportamento pega no CI antes do merge).

**Inicialização:** `provideAuth()` registra os provedores de autenticação. Em `provideRuntimeConfig()`, um único `APP_INITIALIZER` carrega a configuração via `HttpBackend`, popula `AppConfigService` e chama `AuthService.init()` com a configuração derivada. Os tokens são providos por factories que leem o serviço após o carregamento.

**`apps/<app>/src/app/app.config.ts`:**

```ts
provideRuntimeConfig(),
provideAuth(),
```

Apenas. Sem importar `environment`.

**Testes de comportamento:** cada `apps/<app>/src/app/app.config.spec.ts` verifica o carregamento, a autenticação e a falha de inicialização, usando apoio compartilhado de teste. A ordem dos provedores também é exercitada nas duas possibilidades.

### Esta ADR não decide

- **Remoção de `environment.prod.ts` e `fileReplacements`** (CA-06 da Story #84) — fica para PR posterior, após validação em staging do runtime config funcionando ponta-a-ponta. `environment.ts` continua como fallback dev local; `app.config.ts` simplesmente não importa mais.
- **ConfigMaps K8s em `infra/k8s/`** (CA-07) — diretório novo, escopo infra separado.
- **Topologia estrutural completa da ideia Compozy `frontend-libs-architecture`** (demote `shared-data` → tsc, tag taxonomy 3-dim, ESLint blocking) — frente posterior. Esta ADR é compatível com qualquer das duas direções.

## Consequências

### Positivas

- 1 imagem Docker por app, promovida entre ambientes via `ConfigMap` (cumpre ADR-0020).
- `app.config.ts` das 3 apps com 2 linhas relevantes — `provideRuntimeConfig() + provideAuth()`.
- Testes de comportamento verificam a inicialização no CI.
- `shared-auth` desacoplada de `shared-data` (apenas o token cruza fronteira).
- `AppConfigService.get()` lança claramente se chamado antes do load — bug de bootstrap order visível em vez de silencioso.
- Testes unitários trivialmente mockam `{ provide: AUTH_CONFIG, useValue: stub }`.

### Negativas

- `shared-data` adquire `peerDependency` `@org/shared-auth` (cross-import ng-packagr, exige `paths` override em `tsconfig.lib.prod.json` apontando para `dist/libs/shared-auth` — recipe da [ADR-0020](0020-registry-ghcr-e-tagging.md) aplicada cross-lib desde PR #224).
- Para apps que NÃO usam autenticação OIDC (hipotético), `AUTH_CONFIG` continua sendo provido — desperdício mínimo.

### Neutras

- `environment.ts` de dev permanece como fallback local; `nx serve` continua funcionando sem ConfigMap (lê o `runtime-config.json` placeholder copiado para `dist/apps/<app>/browser/assets/`).

## Confirmação

- `npx nx run-many --target=build --projects=selecao,ingresso,portal` verde.
- `npx nx run-many --target=lint,typecheck,vite:test --projects=shared-utils,shared-core,shared-auth,shared-data,shared-ui,selecao,ingresso,portal` verde.
- Testes de inicialização verdes para cada aplicativo.
- `apps/<app>/public/assets/runtime-config.json` placeholder existe em cada app.

### Trigger de reavaliação

- Quando um novo aplicativo entrar, adicionar seu teste de inicialização com o apoio compartilhado.
- Se a topologia Compozy `frontend-libs-architecture` (Onda 1) demove `shared-data` para `@nx/js:tsc`, este ADR continua válido — apenas a localização dos providers pode migrar para uma `shared-config` lib dedicada.

## Prós e contras das opções

### A — `provideAuth()` lê `AppConfigService` internamente

- **Bom** porque boilerplate zero.
- **Ruim** porque acopla `shared-auth → shared-data` — viola a futura taxonomia `type:auth → type:core, type:util` (sem `type:data`).
- **Ruim** porque oculta o ponto de leitura — debug de "qual config?" exige pular para `AuthService` em vez de ler o `app.config.ts`.

### B — `provideAuth(() => AuthConfig)` factory

- **Bom** porque desacopla `shared-auth ↔ shared-data`.
- **Bom** porque o ponto de leitura fica explícito no `app.config.ts`.
- **Ruim** porque boilerplate de 5-7 linhas por app.
- **Ruim** porque proteção contra factory mal-construída é apenas runtime DI (sem testes de comportamento da inicialização).

### C — `AUTH_CONFIG` InjectionToken (escolhida)

- **Bom** porque idiomático Angular puro.
- **Bom** porque desacoplado.
- **Bom** porque zero boilerplate por app (token provido pela própria `provideRuntimeConfig`).
- **Bom** porque os testes garantem a inicialização cross-app no CI.
- **Ruim** porque adiciona um cross-import `shared-data → shared-auth` (mitigado por `paths` override no `tsconfig.lib.prod.json`, pattern já estabelecido pela ADR-0020).

### Status quo (`environment.prod.ts` + `fileReplacements`)

- **Bom** porque já implementado.
- **Ruim** porque viola "imagem única por app" da ADR-0020 — bundle compila com placeholders, ConfigMap não muda nada em runtime.
- **Ruim** porque exige rebuild por ambiente.

## Mais informações

- Story [`uniplus-web#84`](https://github.com/unifesspa-edu-br/uniplus-web/issues/84) — runtime config via `provideAppInitializer` + ConfigMap.
- [ADR-0020](0020-registry-ghcr-e-tagging.md) — invariante "imagem única por app".
- [Angular `provideAppInitializer` API](https://angular.dev/api/core/provideAppInitializer).
- [Angular `InjectionToken` docs](https://angular.dev/api/core/InjectionToken).
- Issue uniplus-web#4 — hardening de containers (pré-requisito da #84 entregue na PR de imagens).
- Fitness pattern: `apps/selecao/src/app/features/__fitness__/no-direct-http-in-pages.fitness.spec.ts` (referência de implementação).

# Guia de Contribuição — Uni+ Web

Este documento descreve como contribuir com o frontend da plataforma Uni+. Leia-o por completo antes de abrir sua primeira contribuição.

> **Regras transversais de commits e integração:** este repositório segue o **[Guia de Commits e Integração](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md)** — referência oficial para todos os repositórios do projeto (`uniplus-api`, `uniplus-web`, `uniplus-docs`), mantido em `uniplus-docs`. Este documento complementa o guia com regras específicas do frontend.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Verificação |
|---|---|---|
| Node.js | 22 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| Git | 2.40+ | `git --version` |
| GitHub CLI | 2.50+ | `gh --version` |

### Setup inicial

```bash
git clone git@github.com:unifesspa-edu-br/uniplus-web.git
cd uniplus-web
nvm use   # lê a versão do .nvmrc (Node 22 LTS)
npm install
```

> Sem gerenciador compatível com `.nvmrc` (`nvm`, `fnm`, `volta`)? Garanta Node 22.x manualmente — o `npm install` falha com `EBADENGINE` em outras versões (`engine-strict=true` em `.npmrc`).

O `npm install` ativa o hook de pre-commit do `husky`, que roda `lint-staged` em cada `git commit` e formata/valida apenas os arquivos staged. Veja [Estratégia de lint em três camadas](#estratégia-de-lint-em-três-camadas).

---

## Estrutura do projeto

Este é um **Nx workspace** com múltiplas apps Angular independentes e libs compartilhadas.

```
apps/
  selecao/                → App de processos seletivos
    src/
      app/
        features/         → Módulos por funcionalidade (lazy-loaded)
        core/             → Services, guards, interceptors
        shared/           → Componentes locais da app
      environments/
      assets/
  selecao-e2e/            → Testes E2E da app Seleção (Playwright)

  ingresso/               → App de matrícula e ingresso
    src/
      app/
        features/
        core/
        shared/
      environments/
      assets/
  ingresso-e2e/

  portal/                 → Portal público (editais, resultados)
    src/
      app/
        pages/            → Páginas estáticas e de consulta
        core/
      environments/
      assets/
  portal-e2e/

libs/
  shared-ui/              → Wrappers Angular reutilizáveis do Uni+ DS
    src/lib/
      components/         → Botões, tabelas, modais, formulários
      directives/
      pipes/

  shared-auth/            → Integração OIDC/Gov.br
    src/lib/
      services/           → AuthService, TokenInterceptor
      guards/             → AuthGuard, RoleGuard
      models/             → UserProfile, AuthConfig

  shared-data/            → Clients TypeScript gerados do OpenAPI
    src/lib/
      api/                → Clients gerados (NSwag/Kiota)
      models/             → DTOs tipados
      services/           → Wrappers com cache e error handling
```

### Apps vs Libs

| Tipo | Regra |
|---|---|
| **App** | Contém roteamento, layout e composição de features. Não exporta nada. |
| **Lib** | Exporta componentes, services e modelos. Nunca tem roteamento próprio. |

---

## Arquitetura de bibliotecas

### 1. Plataforma vs produto

- **Plataforma** — todas as libs `shared-*` são propriedade do CTIC. Sem ownership por pró-reitoria. Decisões de evolução, refactor e versionamento ficam no time de plataforma; clientes institucionais não revisam código da plataforma.
- **Produto** — cada app (`selecao`, `ingresso`, `portal`) é um produto institucional com stakeholder distinto (CEPS, CRCA, futuro PROEX/PROPIT). Stakeholders fornecem requisitos e validam aceite; não revisam código.

### 2. Escopo canônico das libs `shared-*`

| Lib | Escopo |
|---|---|
| `@uniplus/shared-core` | Infra HTTP Angular: `LoadingService`, `NotificationService`, `ProblemI18nService`, `ApiResultInterceptor`, `HttpContext` tokens (vendor MIME, idempotency), `useApiResource`, `parseLink`, paginação cursor |
| `@uniplus/shared-data` | DTOs, `schema.ts` gerado por OpenAPI, classes de serviço, `InjectionToken` de base paths, `ValidatorFn` de domínio (CPF, cota), runtime config (`provideRuntimeConfig`), utilidades puras de dados |
| `@uniplus/shared-ui` | Componentes Angular standalone, pipes, shells e wrappers do Uni+ DS CSS-only; PrimeNG apenas quando encapsulado e justificado |
| `@uniplus/shared-auth` | Integração OIDC: `AuthService`, `UserContextService`, route guards, HTTP interceptors, `provideAuth`, `AUTH_CONFIG` token |
| `@uniplus/shared-utils` | Utilitários TypeScript puros, sem runtime Angular (ex: `formatCpfProgressive`) |
| `@uniplus/shared-inscricao/*` | Apresentação do domínio da inscrição usada por mais de um app (ex.: o comprovante); recebe o DTO pronto e só importa tipos de `@uniplus/shared-data` ([ADR-0030](docs/adrs/0030-lib-de-apresentacao-do-dominio-da-inscricao.md)) |

### 3. Regra de criação (rule of three + first-real-feature)

- Componente/serviço/utilitário usado por **um** app e **uma** feature → mora em `libs/<scope>/<nome>/` criada via generator (próxima seção).
- Usado por **dois ou mais** apps ou com reutilização cross-cutting hoje → mora na lib `shared-*` apropriada.
- Em dúvida → defaulta feature lib local; promover para `shared-*` quando aparecer terceiro consumer.

### 4. Comando do generator

```bash
npx nx g @uniplus/workspace:feature-lib <scope>/<nome> --type=<feature|ui|data-access>
```

Exemplos:

```bash
npx nx g @uniplus/workspace:feature-lib selecao/feature-editais-detail --type=feature
npx nx g @uniplus/workspace:feature-lib portal/data-access-inscricoes --type=data-access
```

`<scope>` é validado contra o set `{selecao, ingresso, portal}` antes do factory rodar; `<type>` é validado pelo enum `{feature, ui, data-access}` no schema do Nx CLI. Tags emitidas no `project.json` gerado: `["scope:<scope>", "type:<type>"]`. Path mapping `@uniplus/<scope>-<nome>` é registrado automaticamente em `tsconfig.base.json`.

Documentação de referência: [`tools/workspace-generators/uniplus-workspace/README.md`](tools/workspace-generators/uniplus-workspace/README.md).

### 5. Required CI checks

A branch protection da `main` exige aprovação dos seguintes status checks (ordem alfabética):

1. `codegen-drift-check`
2. `main`
3. `nx run-many --target=lint --all`
4. `PR author is org member`

Renomeação dos jobs em `.github/workflows/*.yml` exige atualização correspondente da branch protection via `gh api PUT /repos/.../branches/main/protection` — os nomes nesta lista são contratuais.

### 6. Roadmap V2

V1 mantém topologia atual (5 libs em `@nx/angular:ng-packagr-lite`). Reativação de V2 antecipada por [ADR-0021](docs/adrs/0021-runtime-config-via-token.md) — escopo e ordem de reactivation no Epic Onda 2 quando ele for aberto:

- Demote `shared-data` → `@nx/js:tsc` quando custo de metadata `ng-packagr` ficar visível.
- Sub-entry points em `shared-data` (`@uniplus/shared-data/api/selecao`, `/validators`, `/utils`) quando volume de imports justificar.
- Terceira dimensão de tag (`owner:*` ou `client:*`) ao primeiro conflito cross-pró-reitoria.

---

> Última validação: `d7e437504703` em 2026-05-09.

---

## Fluxo de trabalho

### 1. Criar branch

> **Regra de ouro:** sem issue, sem código. Toda mudança não-trivial deve ter issue vinculada no GitHub antes de criar a branch.

```bash
git checkout main
git pull --rebase origin main
git checkout -b feature/{issue-number}-{slug}
```

**Convenção de nomes:**

| Prefixo | Quando usar |
|---|---|
| `feature/` | Nova funcionalidade ou componente |
| `fix/` | Correção de bug |
| `refactor/` | Refatoração sem mudança de comportamento |
| `test/` | Adição ou correção de testes |
| `chore/` | Configuração, dependências, CI/CD |
| `style/` | Ajustes visuais (CSS, layout, responsividade) |

### 2. Implementar

Verifique qual app ou lib será afetada:

```bash
# Verificar o que foi afetado pelas mudanças
npx nx affected --target=build
```

### 3. Testar

```bash
# Lint (todas as apps afetadas)
npx nx affected --target=lint

# Testes unitários (todas as apps afetadas)
npx nx affected --target=test

# Testes E2E (app específica)
npx nx e2e selecao-e2e

# Build de produção (verificar que compila)
npx nx affected --target=build --configuration=production
```

Todos os comandos acima devem passar antes de abrir o PR.

#### Estratégia de lint em três camadas

O lint é checado em três pontos distintos, do mais rápido ao mais abrangente, para evitar acúmulo silencioso de débito em projetos não-afetados:

| Camada | Quando roda | O que executa | Bloqueante? |
|---|---|---|---|
| **Pre-commit local** | Automático em cada `git commit` | `lint-staged` → `eslint --fix` apenas nos arquivos staged | Sim (impede commit) |
| **Lint afetado local** | Manual antes do push da PR | `npx nx affected --target=lint` | Recomendado (não há gate CI dedicado) |
| **CI completo (`lint-full.yml`)** | Em cada PR e push para `main` | `npx nx run-many --target=lint --all` | Sim (gate de merge) |

O hook de pre-commit é configurado via `husky` (`.husky/pre-commit`) e roda automaticamente após `npm install`. Em casos excepcionais, pode-se contornar com `git commit --no-verify` — mas a CI rejeitará o PR se o lint completo falhar.

A regra de aceite: **`npx nx run-many --target=lint --all` deve sair com código 0**. Warnings são tolerados; errors bloqueiam o merge.

### 4. Commit

As regras de formato, tipos permitidos e convenções gerais de mensagem estão definidas no **[Guia de Commits e Integração § 1–4](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md)**. Siga-o na íntegra.

**Escopos válidos neste repositório:**

> Esta tabela é uma lista de apoio, não um conjunto fechado. A regra geral é preferir o nome da **app** ou **lib** afetada — um projeto novo em `apps/` ou `libs/` sem linha aqui usa o nome do próprio diretório, sem esperar que a tabela seja atualizada primeiro.

| Escopo | Quando usar |
|---|---|
| `selecao` | App Seleção (`apps/selecao/`) |
| `selecao-e2e` | Testes E2E Playwright da app Seleção (`apps/selecao-e2e/`) |
| `ingresso` | App Ingresso (`apps/ingresso/`) |
| `ingresso-e2e` | Testes E2E Playwright da app Ingresso (`apps/ingresso-e2e/`) |
| `portal` | App Portal público (`apps/portal/`) |
| `portal-e2e` | Testes E2E Playwright do Portal (`apps/portal-e2e/`) |
| `configuracao` | App Configuração — cadastros base e organização institucional (`apps/configuracao/`) |
| `configuracao-e2e` | Testes E2E Playwright da app Configuração (`apps/configuracao-e2e/`) |
| `shared-ui` | Componentes reutilizáveis do Uni+ DS (`libs/shared-ui/`) |
| `shared-core` | Infra HTTP transversal, interceptors, notificações (`libs/shared-core/`) |
| `shared-data` | API clients, DTOs, utilitários (`libs/shared-data/`) |
| `shared-inscricao` | Apresentação do domínio da inscrição (`libs/shared-inscricao/`) |
| `shared-auth` | OIDC, `libs/shared-auth/` (guards, interceptor, tokens) |
| `shared-utils` | Utilitários puros, pipes, helpers (`libs/shared-utils/`) |
| `shared-e2e` | Fixtures e utilitários Playwright compartilhados (`libs/shared-e2e/`) |
| `ds` | Tokens, foundation e mapeamento CSS do Uni+ DS |
| `poc-primeng` | POC histórica read-only, fora do workspace Nx (`docs/referencias/poc-primeng/`) — ADR-0022 |
| `poc-primeng-e2e` | Suíte E2E histórica da POC (`docs/referencias/poc-primeng-e2e/`) — ADR-0022 |
| `routing` | Roteamento que atravessa mais de uma app (base href, redirects, deep links) |
| `fitness` | Mudança na própria regra de arquitetura (`**/__fitness__/*.fitness.spec.ts`), não no código que ela verifica |
| `adrs` | Registro ou emenda de Architecture Decision Record (`docs/adrs/`) |
| `nx` | Configuração Nx (workspace, targets, caching, affected) |
| `ci` | GitHub Actions, workflows, pipeline |
| `docker` | Dockerfiles, `docker-compose` |
| `deps` | Atualização de pacotes npm |

**Sinônimos obsoletos** — aparecem no histórico, não usar em commits novos:

| Obsoleto | Canônico | Motivo |
|---|---|---|
| `auth` | `shared-auth` | `shared-auth` é o nome do projeto no workspace (`libs/shared-auth/`) |
| `primeng` | `poc-primeng` (POC histórica) ou `shared-ui` (wrapper `ui-*` encapsulado) | nunca teve uso real; os commits existentes usam `poc-primeng` para a POC e `shared-ui` para o encapsulamento corrente |
| `e2e` | `<app>-e2e` ou `shared-e2e` | genérico demais desde que cada app ganhou seu próprio projeto `*-e2e` |
| `adr` | `adrs` | o diretório é `docs/adrs/`, no plural |

Mudanças transversais de tokens ou estilo global usam `ds` ou `shared-ui`.

**Alguns exemplos canônicos:**

```
feat(selecao): adiciona formulário de inscrição multi-etapa
fix(shared-auth): corrige refresh token expirado sem redirect
refactor(shared-ui): extrai componente input cpf para lib compartilhada
style(ds): ajusta tokens de espaçamento do Uni+ DS
test(portal-e2e): adiciona testes do fluxo de inscrição no portal
chore(deps): atualiza dependências Angular
```

Para uma bateria completa de exemplos (bons e ruins, com justificativas), consulte [Guia § 4](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md).

### 5. Rebase sobre `main`

Integração via **rebase** — sem merge commits poluindo o histórico. Procedimento completo e regras de ouro em **[Guia de Commits e Integração § 5–6](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md)**.

Resumo aplicado ao `uniplus-web`: mantenha a branch rebaseada sobre `origin/main`, organize os commits com `rebase -i` (squash/reword/drop) antes do PR e use `git push --force-with-lease` ao reescrever história — nunca `--force` puro.

### 6. Pull Request

```bash
git push -u origin feature/{issue-number}-{slug}

# Criar PR (Closes #N na descrição fecha a issue automaticamente no merge)
gh pr create --base main
```

---

## Regras de integração

Este repositório adota políticas de proteção da branch `main` para garantir histórico linear, previsível e auditável. As regras são aplicadas automaticamente pelo GitHub aos colaboradores sem permissão administrativa.

- Apenas **Rebase merge** é permitido — merge commits e squash estão desabilitados
- Histórico linear obrigatório
- Force-push e deleção da `main` bloqueados
- PRs exigem:
  - 1 aprovação de colaborador com permissão de escrita
  - Status checks de CI passando — detalhes do que cada check verifica em [Quality gates](#quality-gates):
    - `codegen-drift-check` (workflow `CI` — `.github/workflows/ci.yml`, job `codegen-drift-check`; valida que `libs/shared-data/src/lib/api/<modulo>/schema.ts` está em sync com o OpenAPI committed — ADR-0013)
    - `main` (workflow `CI` — `.github/workflows/ci.yml`, job `main`)
    - `nx run-many --target=lint --all` (workflow `Lint completo (workspace)` — `.github/workflows/lint-full.yml`)
    - `PR author is org member` (workflow homônimo — bloqueia PRs de não-membros da organização)
  - Branch atualizada com a `main` antes do merge
  - Todas as conversas do review resolvidas
  - Aprovações anteriores são descartadas a cada novo commit (*dismiss stale reviews*)
  - O último push da branch deve ser feito por usuário diferente do aprovador (*require last push approval*)

Casos excepcionais podem ser tratados por admins do repositório. A política operacional completa — incluindo procedimento de rebase, regras de ouro e troubleshooting — vive no **[Guia de Commits e Integração § 5](https://github.com/unifesspa-edu-br/uniplus-docs/blob/main/docs/guia-commits-e-integracao.md)**, fonte de verdade para todos os repositórios do projeto.

---

## Padrões de código

### Organização de features (por app)

Cada feature é um **módulo Angular lazy-loaded** com estrutura padrão:

```
features/
  inscricao/
    components/           → Componentes visuais da feature
      formulario-inscricao/
      resumo-inscricao/
    services/             → Services específicos da feature
    models/               → Interfaces e tipos locais
    inscricao.routes.ts   → Rotas da feature
    inscricao.component.ts→ Componente raiz da feature
```

### Componentes

| Regra | Detalhe |
|---|---|
| Um componente, uma responsabilidade | Componentes grandes devem ser decompostos |
| Inputs e Outputs tipados | Usar `input()` e `output()` signals do Angular 20 |
| OnPush por padrão | `changeDetection: ChangeDetectionStrategy.OnPush` |
| Standalone components | Não usar NgModules — tudo standalone |

### State management

- **Estado global:** NgRx SignalStore para estado compartilhado entre features
- **Estado local:** Signals do Angular para estado de componente
- **Estado de servidor:** Services com cache via `shareReplay` ou integração com shared-data

### Formulários

- Usar **Reactive Forms** para formulários complexos (inscrição, homologação)
- Validações no formulário devem espelhar as validações da API
- Formulários multi-etapa devem salvar progresso no estado local (draft)
- Nunca desabilitar o botão de submit sem feedback visual ao usuário

### Naming

| Elemento | Convenção | Exemplo |
|---|---|---|
| Componentes | kebab-case (seletor) | `app-formulario-inscricao` |
| Arquivos | kebab-case | `formulario-inscricao.component.ts` |
| Classes | PascalCase (inglês) | `FormularioInscricaoComponent` |
| Services | PascalCase + `Service` | `InscricaoService` |
| Interfaces/Models | PascalCase | `Candidato`, `InscricaoDto` |
| Variáveis | camelCase (inglês) | `candidatoId`, `listaInscricoes` |
| Strings user-facing | pt-BR | `'Inscrição realizada com sucesso'` |
| Labels, placeholders, mensagens | pt-BR | `'Digite seu CPF'` |

### CSS / Tailwind

- **PrimeNG** para componentes complexos (tabelas, calendários, modais, menus)
- **Tailwind CSS** para layout e utilitários (spacing, flex, grid, responsividade)
- Nunca usar `!important` — ajustar especificidade ou usar variáveis CSS do PrimeNG
- Mobile-first: começar pelo layout mobile, expandir com `md:` e `lg:`
- Cores institucionais devem usar variáveis CSS definidas em `shared-ui`

### Tamanho de arquivo

- A regra de tamanho de arquivo (400 linhas físicas, specs, mocks e E2E incluídos) está em [§ Métricas de qualidade](#métricas-de-qualidade).
- `npm run check:tamanho` roda no CI e, por enquanto, mede só arquivo de produção (`.ts`, `.html` e `.css` em `apps/` e `libs/`): ele **ainda não mede `*.spec.ts`, `*.mock.ts`, `*.testing.ts`, `test-setup.ts`, as pastas chamadas `testing`, os projetos `apps/*-e2e` e `libs/shared-e2e`, mas a regra vale para eles** (outros arquivos de apoio a teste, como um `*.fixture.ts` fora desses padrões e dessas pastas, já são medidos), e a revisão a cobra. Arquivo de produção novo acima do limite é recusado.
- Os arquivos de produção que ainda excedem o limite estão em `tools/tamanho-de-arquivo/excecoes.txt`. A lista só diminui: arquivo listado não pode crescer, toda redução tem de ser registrada nela, e ao chegar a 400 linhas ou menos a entrada sai (`npm run check:tamanho -- --atualizar` reduz números e remove entradas). A lista é dívida a pagar, não autorização: o CI aceita arquivo dela que não cresce (e, se diminuir, pede a lista atualizada), mas a regra pede que arquivo alterado pelo PR termine com até 400 linhas.

### Métricas de qualidade

As métricas abaixo valem para todo código que o PR cria ou altera, de produção e de teste (specs, mocks, utilitários de teste e E2E). A revisão as cobra; o ESLint e o `check:tamanho` são sinais auxiliares, não a medida.

| # | Regra | Limite |
|---|---|---|
| 1 | Linhas físicas por função | 15 |
| 2 | Linhas físicas por arquivo | 400 |
| 3 | Parâmetros por função, método ou construtor | 4 |
| 4 | Complexidade cognitiva / ciclomática por função | 15 / 10 |
| 5 | Supressão de aviso | proibida |
| 6 | Código escrito só para caber na métrica | reprovado |

**1. Função: até 15 linhas físicas.** Conta-se da linha da assinatura até a linha da chave final, inclusive, com linhas em branco, comentários e linhas só com chave. Só ficam fora os decorators e o JSDoc que estão acima da assinatura; comentário de qualquer tipo dentro do corpo conta. Arrow function de corpo em expressão, sem chaves, conta da assinatura até a última linha da expressão. Vale para funções, métodos, construtores, getters e setters, toda arrow function e cada caso de teste: cada `it(...)` e `test(...)` conta da linha do `it` até a linha do `});`. O `describe(...)` é agrupador: a função passada a ele não conta como uma função só, porque o que conta são os casos e hooks dentro dele; funções auxiliares declaradas dentro do `describe` contam normalmente, assim como os `beforeEach`/`afterEach`.

O aviso `max-lines-per-function` do ESLint **não é a medida**: ele aceita 30 linhas, não conta linhas em branco e comentários e não roda nos arquivos que o bloco de métricas do `eslint.config.mjs` ignora (`*.spec.ts`, `*.testing.ts`, `*.mock.ts`, `test-setup.ts`, pastas `src/fixtures/` e `src/support/` e os clientes gerados). Uma função de 24 linhas físicas passa nele sem aviso e está fora da regra.

**2. Arquivo: até 400 linhas físicas.** Todas as linhas contam (comentários, imports e linhas em branco), e a última linha conta mesmo sem quebra no fim. Vale para todo arquivo de código do repositório, qualquer que seja a extensão (`.ts`, `.mts`, `.js`, `.mjs`, `.html`, `.css`, `.scss`, `.sh` e outras), em `apps/`, `libs/`, `tools/` ou qualquer outro diretório, specs, mocks e E2E incluídos. Ficam fora só os arquivos gerados: os clientes OpenAPI em `libs/shared-data/src/lib/api/*/schema.ts`. O `check:tamanho` ainda mede só `.ts`, `.html` e `.css` de produção em `apps/` e `libs/` (ver [§ Tamanho de arquivo](#tamanho-de-arquivo)).

**3. Parâmetros: até 4** por função, método ou construtor. A injeção de dependência usa `inject()`, não parâmetro de construtor. O aviso `max-params` do ESLint mede este limite, fora dos specs, como sinal auxiliar.

**4. Complexidade: cognitiva até 15 e ciclomática até 10** por função (`sonarjs/cognitive-complexity` e `complexity` do ESLint).

**5. Supressão de aviso: proibida.** Não se usa `eslint-disable` (de arquivo, de bloco ou de linha), `@ts-ignore`, `@ts-nocheck` nem `@ts-expect-error` para calar aviso: o aviso se corrige no código. Quando o lint revela design ruim, o design é refeito. Desligar uma regra que não se aplica ao workspace inteiro ou a uma categoria de arquivos no `eslint.config.mjs`, com comentário justificando, é decisão de projeto e continua permitido; bloco de configuração que isenta um arquivo específico é supressão disfarçada e também é proibido.

**6. Código feito só para caber na métrica é reprovado**, mesmo dentro dos limites: função-ponte que só repassa a chamada, estado fatiado sem sentido (signals ou serviços criados só para dividir uma função), parâmetros agrupados num objeto artificial que não existe no domínio. A divisão segue responsabilidade, conforme SOLID, Clean Code e as recomendações do Angular (componente de apresentação, serviço, `computed`).

#### Exemplo

Divisão correta: o componente orquestra o envio, e a conversão do formulário para o contrato da API fica numa função pura com nome de domínio. Cada função tem até 15 linhas físicas.

```typescript
protected enviar(): void {
  if (this.formulario.invalid) {
    this.formulario.markAllAsTouched();
    return;
  }
  const inscricao = paraInscricao(this.formulario.getRawValue());
  this.inscricoes.enviar(inscricao).subscribe({
    next: () => this.aviso.sucesso('Inscrição enviada.'),
    error: (erro: unknown) => this.aviso.erroDaApi(erro),
  });
}

// inscricao.mapeamento.ts
export function paraInscricao(valor: ValorDoFormularioDeInscricao): NovaInscricaoDto {
  return {
    processoId: valor.processoId,
    ofertaId: valor.oferta.id,
    modalidade: valor.modalidade,
    nomeSocial: valor.nomeSocial?.trim() || null,
  };
}
```

Divisão reprovada: a função longa foi cortada em pedaços que só repassam, sem responsabilidade própria.

```typescript
protected enviar(): void {
  this.enviarInterno({ formulario: this.formulario, servico: this.inscricoes }); // objeto artificial
}

private enviarInterno(contexto: ContextoDoEnvio): void {
  this.executarParte1(contexto); // função-ponte
}
```

#### Dívida existente e CI

O CI **não barra** a dívida antiga: as regras do ESLint continuam como aviso, o `check:tamanho` ainda não mede specs, mocks e E2E e a lista `tools/tamanho-de-arquivo/excecoes.txt` continua. As regras valem para o que o PR cria ou altera: função nova ou alterada cumpre os limites, e arquivo que o PR cria ou altera termina com até 400 linhas (se já passava, o PR o divide por assunto). A dívida é paga por projeto (cada app e cada lib), cada um com sua issue; quando um projeto zera a dívida, o CI passa a barrar aquele projeto.

---

## Acessibilidade (WCAG 2.1 AA)

**Obrigatório em toda contribuição.** O sistema é de uma universidade federal — acessibilidade é exigência legal (Lei 13.146/2015).

| Regra | Detalhe |
|---|---|
| Labels em todos os inputs | `<label for="...">` ou `aria-label` |
| Navegação por teclado | Todo elemento interativo acessível via Tab |
| Contraste de cores | Mínimo 4.5:1 para texto normal, 3:1 para texto grande |
| Mensagens de erro | Associadas ao campo via `aria-describedby` |
| Imagens | Atributo `alt` descritivo ou `role="presentation"` |
| Modais | Focus trap ativo, fechamento via Esc |
| Loading states | `aria-busy="true"` e `aria-live="polite"` para anúncios |
| Nome acessível de botão/link | Precisa **conter** o texto visível (SC 2.5.3). `aria-label` que reescreve o rótulo quebra comando de voz — "Próximo" com nome "Próxima página" não ativa |
| Texto decorativo dentro de botão/link | Fora do nó de texto: expor por `data-*` e pintar em `::before`. `aria-hidden` esconde do leitor, não da vista, e o critério compara com o que se lê na tela |

### Verificação

```bash
# axe-core integrado ao Playwright (roda nos testes E2E)
npx nx e2e selecao-e2e -- --grep "accessibility"
```

---

## Segurança

### Obrigatório em toda contribuição

- **CPF mascarado** em telas e logs como `***.999.999-**` (Parecer DPO 002/2026), pelas funções `mascararCpf`/`cpfRevelavel` de `@uniplus/shared-utils`; o titular só revela o próprio CPF por ação explícita, com o `ui-dado-revelavel`
- **Nunca logar dados pessoais** no console do navegador
- **XSS:** nunca usar `[innerHTML]` com dados do usuário — usar sanitização do Angular
- **Tokens:** nunca armazenar tokens em localStorage — usar o fluxo OIDC configurado e manter JWT fora de logs
- **Upload:** validar tipo de arquivo, tamanho máximo e exibir preview antes de enviar

### Nome social (prioridade sobre o nome civil, UNI-REQ-0032)

Em qualquer tela que exiba nome de candidato, verificar se existe nome social cadastrado. Se existir, exibir **apenas o nome social** — nunca o nome civil junto.

---

## Testes

### Obrigatório

| Tipo | Onde | Framework | Quando |
|---|---|---|---|
| Unitário | Components, Services, Pipes | Jest + Angular Testing Library | Toda lógica de componente e service |
| E2E | Fluxos completos | Playwright | Todo fluxo crítico do usuário |

### Recomendado

| Tipo | Onde | Framework | Quando |
|---|---|---|---|
| Acessibilidade | Páginas completas | axe-core + Playwright | Toda nova página |
| Visual regression | Componentes UI | Playwright screenshots | Mudanças em shared-ui |

### Convenções de teste

**Testes unitários (Jest):**

```typescript
// formulario-inscricao.component.spec.ts
describe('FormularioInscricaoComponent', () => {
  it('deve bloquear submit quando CPF é inválido', () => {
    // Arrange
    const { getByRole, getByLabelText } = render(FormularioInscricaoComponent);

    // Act
    fireEvent.input(getByLabelText('CPF'), { target: { value: '000.000.000-00' } });

    // Assert
    expect(getByRole('button', { name: /enviar/i })).toBeDisabled();
  });
});
```

**Testes E2E (Playwright):**

```typescript
// inscricao.spec.ts
test('candidato deve conseguir completar inscrição', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByLabel('CPF').fill('123.456.789-09');
  await page.getByLabel('Nome completo').fill('Maria da Silva');
  // ...
  await page.getByRole('button', { name: 'Enviar inscrição' }).click();
  await expect(page.getByText('Inscrição realizada com sucesso')).toBeVisible();
});
```

- Usar **dados fictícios** — nunca dados reais de candidatos
- Testes E2E devem rodar **sem navegador visível** (headless) no CI
- Testes unitários devem rodar **sem dependência de browser**

---

## Quality gates

O PR será bloqueado se qualquer gate falhar:

- [ ] Build de produção sem erros (`nx build {app} --configuration=production`)
- [ ] Lint sem erros no workspace inteiro (`nx run-many --target=lint --all` — gate `lint-full.yml`)
- [ ] Todos os testes unitários passando
- [ ] Todos os testes E2E passando
- [ ] Testes de acessibilidade passando (axe-core)
- [ ] Nenhuma vulnerabilidade crítica em dependências (`npm audit`)

---

## Checklist antes de pedir merge

Complementa os Quality gates acima (verificações de CI automáticas) com higiene de commits e branch — essas são verificações humanas:

- [ ] Branch no padrão (`feature/{issue}-{slug}`, `fix/{issue}-{slug}`, `chore/{slug}`, `style/{slug}` ou `docs/{slug}`)
- [ ] Issue vinculada no GitHub (regra de ouro: sem issue, sem código)
- [ ] Todos os commits seguem Conventional Commits em pt-BR
- [ ] Verbo no **imperativo presente** (`adiciona`, `corrige`, `remove`, `atualiza`) — nunca infinitivo (`adicionar`) nem gerúndio (`Adicionando`)
- [ ] Subject em minúsculas, sem ponto final, máx. ~72 caracteres
- [ ] Escopo presente (conforme a regra de [§ Commit](#4-commit)) quando aplicável
- [ ] Branch **rebaseada** sobre a `main` mais recente
- [ ] Commits "WIP" / "ajustes do PR" foram **squashados** via `git rebase -i`
- [ ] PR vinculado à issue com `Closes #N` na descrição
- [ ] Métricas de qualidade cumpridas no código criado ou alterado, specs incluídos, sem supressão de aviso ([§ Métricas de qualidade](#métricas-de-qualidade)) — o CI ainda não as barra

---

## Revisão de código

Todo PR passa por revisão humana. O revisor verifica:

1. **Acessibilidade** — WCAG 2.1 AA, navegação por teclado, contraste
2. **Responsividade** — funciona em mobile, tablet e desktop
3. **Segurança** — PII masking, XSS, tokens
4. **Qualidade** — componentes pequenos, OnPush, sem lógica no template e as [métricas de qualidade](#métricas-de-qualidade) contadas em linhas físicas
5. **UX** — feedback ao usuário (loading, erros, sucesso), pt-BR correto

O PR precisa de **1 aprovação** para ser mergeado.

---

## Dúvidas

- Abra uma issue com a label `needs-refinement` para discutir abordagens
- Consulte a documentação em [uniplus-docs](https://github.com/unifesspa-edu-br/uniplus-docs) para contexto de requisitos e regras de negócio
- Consulte a API em [uniplus-api](https://github.com/unifesspa-edu-br/uniplus-api) para contratos e endpoints

---
status: "proposed"
date: "2026-05-06"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0017: Páginas de feature no padrão container/presentational — `XxxPage` smart + `ui-*` dumb

## Contexto e enunciado do problema

O Frontend Milestone B começa a entregar features reais (Editais lista na F6, Editais criar/detalhar/publicar nas F7/F8) consumindo o contrato V1 (`ApiResult<T>`, vendor MIME, Idempotency-Key, cursor pagination). Cada feature precisa decidir **como** estrutura sua página: tudo num único componente, ou separada em camadas com responsabilidades distintas.

A POC `apps/poc-primeng/src/app/features/inscricao/` já validou uma forma — `inscricao-page.ts` orquestra serviços e estado enquanto `components/dados-pessoais-tab/`, `documentos-tab/` e `revisao-tab/` são componentes apresentacionais consumidos via inputs. Mas a separação ali emergiu organicamente, sem decisão registrada. Sem ADR explícita, cada nova feature pode reinventar a estrutura: alguém pode misturar HTTP calls dentro de um `ui-table` reusável, outra pessoa pode tornar `EditaisListPage` totalmente template-driven sem services, e em 6 meses o app vira um patchwork de patterns inconsistentes.

A questão é dupla: **(a) o pattern é binding** (toda feature page deve seguir) ou opcional (caso a caso)? **(b) qual é a fronteira exata** — onde container começa e presentational termina?

## Drivers da decisão

- **Reuso real** — `DataTableComponent` na F6 vai consumir Editais; em F7/F8 vai aparecer em outras features (Inscrições, Homologação). Se o componente fizer HTTP direto, não dá para reusar — fica acoplado a um único endpoint.
- **Testabilidade** — container com signals + service mock é trivial de testar com `HttpTestingController`; presentational com inputs/outputs testa renderização sem mock de services.
- **Convenção compartilhada com a comunidade Angular** — Joshua Morony, Lars Gyrup Brink Nielsen, Tim Deschryver convergem para este pattern em apps signal-based. Nomes variam (smart/dumb, container/presentational, page/component) mas a separação é consistente.
- **Escala do team** — 7 contribuidores no projeto (CTIC + DIRSI + PROGEP); convenção explícita reduz ramp-up e divergência de estilo entre features.
- **Clean Architecture analogia** — pages = use cases, services = application, libs `shared-*` = ports/adapters. Apresentacional sem dependência de service é o equivalente UI de "domain puro".
- **Não inventar nada novo** — Angular standalone + signals + `inject()` já é a forma idiomática moderna; este ADR só formaliza a divisão.

## Opções consideradas

- **A. Pattern binding container/presentational com nomenclatura `XxxPage` (smart) e `ui-*` ou `feature-component` (dumb).** Containers vivem em `apps/<app>/src/app/features/<feature>/<feature>-<acao>.page.ts`; presentational reutilizáveis em `libs/shared-ui/`.
- **B. Pattern opcional — cada feature decide.** Sem regra; revisão de PR pode pedir refator se algo virar bagunça.
- **C. Componente único por página, sem separação.** Tudo no mesmo arquivo (HTTP + estado + template).
- **D. Hexagonal frontend completo — ports/adapters explícitos, view-models separados, etc.** Over-engineering para o estágio atual do produto.

## Resultado da decisão

**Escolhida:** "A — Pattern binding container/presentational com nomenclatura padronizada", porque é a única opção que:

1. Garante que `DataTableComponent`, `FileUploadComponent`, `CpfInputComponent` etc. permaneçam **reutilizáveis** entre apps (Selecao, Ingresso, Portal) — sem container, qualquer presentational acaba acoplado a um endpoint por descuido.
2. Cria **consistência cross-feature** sem custo cognitivo — toda página segue a mesma forma; revisão de PR é mecânica.
3. **Não codifica mais do que precisa** (D over-engineering). Container + presentational é suficiente para V1; ports/adapters explícitos podem aparecer depois se complexidade exigir.
4. **Apoia decisão B** ao tornar a regra explícita — review de PR pode citar a ADR em vez de discussão subjetiva.

### Forma do pattern

#### Container (smart) — `XxxPage`

- Localização: `apps/<app>/src/app/features/<feature>/<feature>-<acao>.page.ts`.
- Naming convention: `<feature>-<acao>.page.ts` exportando `class XxxPage` (ex.: `editais-list.page.ts` → `EditaisListPage`).
- Selector convention: `<app-prefix>-<feature>-<acao>-page` (ex.: `sel-editais-list-page` para `selecao`).
- Responsabilidades:
  - **Estado reativo** via `signal<T>()`/`computed()`/`effect()`.
  - **Injeção de services** (`EditaisApi`, `ProblemI18nService`, `Router`, `KeycloakService`, etc.) via `inject()`.
  - **Orquestração** — disparar HTTP, mapear `ApiResult<T>` para signals, navegar.
  - **Resolução de erros** via `ProblemI18nService.resolve(problem)`.
  - **Sem template visual reutilizável** — o template do container é a composição de presentational, não interface complexa própria.
- Restrições:
  - Standalone, OnPush, signals.
  - Pode importar `libs/shared-*`.
  - **Não exporta-se para outras apps** — vive dentro do `apps/<app>/`.

#### Presentational (dumb) — `ui-<nome>`

- Localização: `libs/shared-ui/src/lib/components/<nome>/<nome>.ts`.
- Naming convention: `<nome>.ts` exportando `class XxxComponent`.
- Selector convention: `ui-<nome>` (kebab-case com prefixo `ui`, regra de ESLint do `shared-ui`).
- Responsabilidades:
  - **Render visual** baseado em inputs.
  - **Eventos via outputs** — não toca em service nem em router.
- Restrições:
  - Standalone, OnPush, signals (inputs como `input.required<T>()` ou `input<T>()`).
  - **Pode importar `libs/shared-core`** para tipos de domínio cross-cutting (ex.: `Cursor`, `ProblemDetails`) — não viola Nx module boundaries (ambos têm `scope:shared`).
  - **Não pode importar** `shared-data`, `shared-auth` ou qualquer service específico de feature.
  - `eslint.config.mjs` já enforça selector prefix `ui` em `libs/shared-ui/`.

#### Composição

```ts
@Component({
  selector: 'sel-editais-list-page',
  imports: [DataTableComponent],
  template: `
    <ui-data-table
      [columns]="colunas"
      [data]="rows()"
      [loading]="loading()"
      [errorMessage]="errorMessage()"
      [nextCursor]="nextCursor()"
      (loadNext)="aoCarregarMais($event)"
    />
  `,
})
export class EditaisListPage {
  private readonly api = inject(EditaisApi);
  private readonly problemI18n = inject(ProblemI18nService);
  // ...
}
```

### Esta ADR não decide

- **Padrão de erro inline em forms** — F7 (Editais criar) é onde forms tipados aparecem; pattern de mapping `ProblemDetails.errors[]` → `FormControl.setErrors` é responsabilidade da Story de implementação (atualizar ADR-0014 com seção "Form-scoped key aplicada" também).
- **State management cross-page** (NgRx, Signal Store) — nenhuma feature de V1 precisa hoje; reabre se compartilhamento de estado entre páginas crescer.
- **Patterns para roteamento aninhado** (parent/child com router-outlet) — não há feature V1 que exija até agora; ADR futura quando necessário.
- **Container components que recebem dados do `Router` (resolvers)** — patterns simples (constructor disparando carga inicial) são suficientes para V1; resolvers reabrem se cenário de SSR ou pre-fetch crítico aparecer.

### Por que B, C, D foram rejeitadas

- **B (opcional).** Sem regra explícita, decisões de PR viram discussão subjetiva ("eu gosto assim"); o desalinhamento se acumula em débito de leitura quando o time cresce.
- **C (componente único).** Acopla HTTP a render. Reuso impossível — `DataTableComponent` específico de Editais não serve para Inscrições. Testabilidade prejudicada — todo teste exige `HttpTestingController`.
- **D (hexagonal completo).** Adiciona ports/adapters/view-models antes de existir cenário que justifique. Over-engineering aumenta surface de decisão para cada nova feature.

## Consequências

### Positivas

- **Reuso garantido** — `ui-*` componentes vivem em `shared-ui` e são compostos por qualquer feature/app.
- **Testabilidade dupla** — container com `HttpTestingController` + service mock; presentational com `setInput` + `By.css`.
- **Onboarding direto** — toda feature segue a mesma forma; novo dev encontra `editais-list.page.ts` e sabe onde está o estado.
- **Review de PR mecânico** — basta validar contra a ADR em vez de discussão estilística.

### Negativas

- **2 arquivos por página** quando 1 bastaria. Custo aceitável: o mapping é mecânico e o ganho de testabilidade compensa.
- **Risco de presentational virar leak abstraction** se receber muitos inputs / outputs — sinal de que a fronteira está errada (split em sub-presentational ou consolidar). Mitigação: revisão de PR.

### Neutras

- **Selectors longos** (`sel-editais-list-page`) — verbose mas legíveis em DOM inspector e a11y trees.

## Confirmação

1. **Code review** rejeita PR de feature page que faça HTTP direto em template ou injete service em componente `ui-*`.
2. **ESLint** já enforça selector prefix por lib (`ui-` em `shared-ui`, `sel-` em `selecao`, etc.) — divergências quebram CI.
3. **Cobertura de testes** segue o pattern dual: `*.page.spec.ts` testa container com mocks; `*.spec.ts` em `shared-ui` testa render isolado.

## Mais informações

- POC `apps/poc-primeng/src/app/features/inscricao/` — referência pré-existente do pattern.
- [Joshua Morony — "Component Architecture in Angular"](https://www.youtube.com/@JoshuaMorony) — canal de referência do pattern signal-based.
- [Lars Gyrup Brink Nielsen — "Angular Architects"](https://layered-architecture.com) — separation of concerns em apps Angular.
- [Tim Deschryver — Smart vs Presentational components](https://timdeschryver.dev) — patterns de teste com Testing Library.
- [Angular Docs — Components overview](https://angular.dev/guide/components) — standalone, signals, OnPush.
- [ADR-0001](0001-separacao-em-tres-aplicacoes-frontend.md) + [ADR-0003](0003-nx-como-build-system-do-monorepo-frontend.md) — separação em apps + Nx module boundaries (`scope:shared`).
- [Issue uniplus-web#196](https://github.com/unifesspa-edu-br/uniplus-web/issues/196) — Story F6 que originou esta ADR (primeira aplicação binding).

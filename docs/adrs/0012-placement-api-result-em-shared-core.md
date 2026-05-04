---
status: "accepted"
date: "2026-05-04"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0012: Placement do `ApiResult<T>` em subpasta de `shared-core`, não em nova lib

## Contexto e enunciado do problema

A [ADR-0011](0011-consumer-adapter-api-result.md) decidiu que o adapter `ApiResult<T>` + `apiResultInterceptor` consolidado + `ProblemI18nService` viveriam em uma **nova lib `libs/shared-http`** com path alias `@uniplus/shared-http` e tags `scope:shared, type:http`.

Em revisão pelo Tech Lead pós-merge, o placement foi reconsiderado a partir de uma analogia simétrica com a estrutura do backend `uniplus-api`:

| Camada | `uniplus-api` (backend) | `uniplus-web` (frontend antes da ADR-0011) | `uniplus-web` (com ADR-0011) |
|---|---|---|---|
| Cross-cutting infra | `Infrastructure.Core` (1 projeto único — middleware, logging, CorrelationId, Wolverine middleware, etc.) | `shared-core` (1 lib — `error.interceptor.ts`, `NotificationService`, `LoadingOverlayComponent`) | `shared-core` + nova `shared-http` (2 libs com responsabilidade adjacente) |

O backend manteve **um único projeto cross-cutting** com sub-pastas internas. A ADR-0011 propôs fragmentar o frontend antes de ele ter alcançado o threshold de complexidade que justificaria a divisão. Esta ADR superseder o **placement** decidido pela 0011 mantendo o restante do design.

## Drivers da decisão

- **Simetria com backend.** Backend tem 3 projetos shared (`Application.Abstractions`, `Infrastructure.Core`, `Kernel`) e mantém HTTP-adjacent infra dentro de `Infrastructure.Core`. Frontend deveria seguir a mesma economia de projetos enquanto não houver necessidade real.
- **YAGNI sobre evolução futura.** A justificativa "futuras features (idempotency client, cursor parsing helpers, content negotiation accept-header builder) ficarão isoladas em `shared-http`" é especulativa. Esses helpers ainda não existem; quando existirem, podem nascer em `shared-core/http/` e migrar para lib própria via refactor manual (gerar nova lib, mover arquivos, ajustar imports) quando atingirem complexidade que justifique.
- **Custo de manutenção real.** Cada lib Nx adiciona `project.json`, `tsconfig.lib.json`, `tsconfig.spec.json`, configuração ESLint, configuração Vitest, path alias em `tsconfig.base.json`, entrada em `nx.json`. Multiplicar por libs ainda imaturas é cargo cult.
- **Fronteira por subpasta + ESLint.** O argumento "fronteira explícita via tag Nx" da ADR-0011 pode ser expressa por **subpasta nomeada** dentro de `shared-core` (`shared-core/src/lib/http/`) sem precisar de novo `project.json`. Convenção de import (`@uniplus/shared-core` → namespace estável) já enforça boundary.
- **`shared-core` é destino natural.** O `error.interceptor.ts` que será substituído já vive em `shared-core/interceptors/`; o novo `apiResultInterceptor` toma seu lugar. Mover para outra lib durante a substituição complica o refactor sem ganho.
- **Promoção incremental quando justificada.** Se subdiretório `http/` ultrapassar threshold de complexidade (~20 arquivos com lógica não-trivial, ou bibliotecas de cliente codegen consumindo-o como dependência transitiva pesada), promover para lib própria é um comando Nx — não há lock-in arquitetural na decisão de hoje.

## Opções consideradas

- **A. Manter o adapter em `libs/shared-core/src/lib/http/` (subpasta)**, exportado via `@uniplus/shared-core`, sem nova lib nem path alias adicional.
- **B. Manter a decisão original da ADR-0011** (criar `libs/shared-http`).
- **C. Estender `libs/shared-data`** (a outra alternativa rejeitada pela ADR-0011) — mover o adapter para perto dos DTOs e clients.

## Resultado da decisão

**Escolhida:** "A — adapter em `libs/shared-core/src/lib/http/` (subpasta)", porque é a única opção que respeita a simetria com backend, evita criar lib justificada por código especulativo e mantém o destino natural do refactor (substituir `error.interceptor.ts` no mesmo lugar onde ele vive).

### Layout adotado

```text
libs/shared-core/src/lib/
├── http/                          # nova subpasta (substitui interceptors/error.interceptor.ts)
│   ├── api-result.ts
│   ├── problem-details.ts
│   ├── api-result.interceptor.ts
│   ├── problem-i18n.service.ts
│   └── api-result.testing.ts
├── notifications/                 # já existe — NotificationService
├── overlays/                      # já existe — LoadingOverlayComponent
└── interceptors/
    └── error.interceptor.ts       # DELETADO durante o refactor (T20 do _tasks.md)
```

`libs/shared-core/src/index.ts` re-exporta os símbolos públicos da subpasta `http/`. Consumidores importam de `@uniplus/shared-core` exatamente como já fazem para `NotificationService` ou `LoadingOverlayComponent`.

### O que da ADR-0011 permanece válido

Toda a substância de design da [ADR-0011](0011-consumer-adapter-api-result.md) **permanece binding**:

- Tipo `ApiResult<T>` como discriminated union `{ ok: true; data: T } | { ok: false; problem: ProblemDetails }`.
- Tipo `ProblemDetails` matching wire format RFC 9457 + extensions Uni+ (`code`, `traceId`, `errors[]`, `legal_reference`, `available_versions`).
- `apiResultInterceptor` consolidado substituindo `api-error-handler.service.ts` (em `shared-data`) e `error.interceptor.ts` (em `shared-core`) — ambos serão deletados durante a migração.
- `ProblemI18nService` para overrides keyed por `problem.code`.
- `auth-error.interceptor` em `shared-auth` permanece intocado — apenas passa a consumir `ApiResult` parseado upstream.
- Wiring nos apps (`apps/portal`, `apps/selecao`, `apps/ingresso`) registrando os interceptors em `app.config.ts` na ordem `apiResultInterceptor` → `authErrorInterceptor`.

### O que esta ADR muda

Apenas o **placement**:

| Aspecto | ADR-0011 (superseded) | ADR-0012 (esta) |
|---|---|---|
| Lib | Nova `libs/shared-http` | `libs/shared-core` (existente) |
| Path alias | `@uniplus/shared-http` (novo) | `@uniplus/shared-core` (existente) |
| Tags Nx | `scope:shared, type:http` (novas) | tags atuais de `shared-core` |
| ESLint module boundaries | Regra nova para `type:http` | Regras atuais de `shared-core` |
| Estrutura interna | `libs/shared-http/src/lib/*.ts` | `libs/shared-core/src/lib/http/*.ts` |

### Caminho de promoção futura para lib própria

Esta ADR explicitamente **não fecha a porta** para criar `libs/shared-http` mais tarde. Quando o subdiretório `http/` cumprir um destes critérios:

- Mais de 20 arquivos com lógica não-trivial (helpers maduros para idempotency-key client, cursor parsing, content negotiation accept-header builder, retry policy, etc.).
- Cliente Angular codegen (`libs/api-selecao-client`) ou outras libs ficam acopladas pesadamente ao subdiretório, justificando export estável separado.
- Mudança de equipe ou ownership exige isolamento técnico.

…então a subpasta vira lib própria. **Não há lock-in arquitetural** na decisão de hoje: o design do adapter (tipos, interceptor, i18n service) é independente do local físico, e a promoção é refactor mecânico — gerar a nova lib via `nx g lib`, deslocar os arquivos, atualizar imports dos consumidores via codemod. Os passos exatos serão definidos no PR de promoção, quando o contexto real existir; descrever procedimento agora seria especulação sobre código que ainda não foi escrito.

### Esta ADR não decide

- O design do adapter em si — herdado integralmente da [ADR-0011](0011-consumer-adapter-api-result.md).
- Quando exatamente promover para lib própria — critério baseado em sinais reais (complexidade, ownership), não calendário.
- Estratégia de codegen futura do `ProblemDetails` a partir de OpenAPI — segue como follow-up sem alterar placement.

### Por que B e C foram rejeitadas

- **B (manter `libs/shared-http`).** Cria fragmentação prematura simetricamente oposta à economia que o backend pratica. Evolução futura especulativa não justifica custo de manutenção real (project.json, configs, paths) nem cognitive overhead de uma lib a mais imatura.
- **C (estender `shared-data`).** A própria ADR-0011 já rejeitou — conflata data shapes (DTOs, validators) com HTTP-protocol concerns. Concordamos com aquela rejeição; aqui apenas escolhemos `shared-core` em vez de nova lib.

## Consequências

### Positivas

- **Simetria com backend.** Estrutura de cross-cutting infra fica consistente entre `uniplus-api` (`Infrastructure.Core`) e `uniplus-web` (`shared-core`).
- **Menos manutenção.** Sem novo `project.json`, sem novo path alias, sem nova entrada em `nx.json`/`tsconfig.base.json`.
- **Refactor mais simples.** Substituir `error.interceptor.ts` por `api-result.interceptor.ts` no mesmo lugar evita imports cross-lib desnecessários durante a migração.
- **YAGNI honesto.** Evolução futura para lib própria é caminho aberto via refactor manual, mas não é prematura.
- **Consumidores não percebem diferença.** Import vem de `@uniplus/shared-core` (já existente) em vez de `@uniplus/shared-http` (que seria novo); diff de import é mínimo.

### Negativas

- **`shared-core` cresce ligeiramente.** Subpasta `http/` adiciona ~5 arquivos. Mitigação: subpasta nomeada deixa a fronteira de propósito clara dentro da lib.
- **Risco de "tudo no shared-core".** Sem disciplina, `shared-core` pode virar dump de qualquer cross-cutting. Mitigação: revisão de PR enforça que novas subpastas só nascem para concerns coesos; quando uma subpasta amadurecer, promove para lib própria.
- **Reabertura de decisão recém-mergeada.** ADR-0011 foi mergeada horas antes desta superseder. Custo de noise no histórico, mas ganho de honestidade arquitetural — decisão revisada antes de virar código vale mais do que decisão errada cimentada.

### Neutras

- ESLint module boundaries continuam funcionando — `shared-core` já é importado por features, UI, data, auth.
- Testes ficam em `libs/shared-core/src/lib/http/*.spec.ts` co-localizados com a implementação, padrão idiomático Vitest.

## Confirmação

1. **Revisão de PR** — toda PR que adicione novo módulo HTTP-adjacente deve usar `libs/shared-core/src/lib/http/<modulo>/`; criação de nova lib só após justificativa explícita contra os critérios listados em "Caminho de promoção futura".
2. **ESLint enforce** — `@nx/enforce-module-boundaries` continua aplicado; nada muda na configuração existente.
3. **Vitest co-localizado** — testes da subpasta `http/` rodam junto com `shared-core` na suíte `nx vite:test shared-core`.

## Mais informações

- [ADR-0011](0011-consumer-adapter-api-result.md) — superseded em parte por esta ADR (apenas placement; design e migração permanecem válidos).
- ADR-0002 do `uniplus-api` (Clean Architecture) — base da analogia de simetria entre backend e frontend para cross-cutting infra.
- [Nx — Library generation](https://nx.dev/recipes/angular/library) — referência para `nx g lib` quando a promoção for feita.
- Princípio YAGNI ("You Aren't Gonna Need It") — base da rejeição de criar lib justificada por código especulativo.

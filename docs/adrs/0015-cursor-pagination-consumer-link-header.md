---
status: "accepted"
date: "2026-05-06"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0015: Cursor pagination consumer via parser de `Link` header — decode no caller, não no interceptor

## Contexto e enunciado do problema

A `uniplus-api` pagina coleções (ex.: `GET /api/editais`) por **cursor opaco cifrado AES-GCM** propagado em header `Link` (RFC 5988/8288), conforme [ADR-0026](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0026-paginacao-cursor-opaco-cifrado.md). [ADR-0031](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0031-decoding-de-cursor-opaco-no-boundary-http.md) do backend é explícita: o **decode do payload AES-GCM ocorre no boundary HTTP server-side** — frontend trata o cursor como string opaca, jamais decifra.

O `apiResultInterceptor` da F1 já entrega `ApiResult<T>` com `headers: HttpHeaders` no envelope de sucesso. Falta decidir **onde** vivem os helpers que extraem o próximo cursor do header `Link` e **quem** dispara essa extração — interceptor ou caller.

A questão é tripla: forma do tipo `Cursor`, lugar do parser, gatilho da extração.

## Drivers da decisão

- **Conformidade com [ADR-0026](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0026-paginacao-cursor-opaco-cifrado.md) e [ADR-0031](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0031-decoding-de-cursor-opaco-no-boundary-http.md) do `uniplus-api`** — cursor é opaco no boundary; cliente nunca inspeciona o conteúdo. Tipo no frontend deve **garantir** essa opacidade via tipo, não só por convenção.
- **Pattern simétrico com `withVendorMime` e `withIdempotencyKey` (F1, F3)** — o `apiResultInterceptor` é o único leitor de `HttpContext` da chain HTTP (ADR-0014). Adicionar auto-detecção de paginação no interceptor mudaria seu **contrato de saída** (de `ApiResult<T>` para `ApiResult<PaginatedResponse<T>>`) silentemente — caller não tem como saber qual forma esperar sem ler o body em runtime.
- **Tipo opaco no boundary client-side** — `Cursor` é uma string para todos os efeitos práticos, mas tratá-lo como `string` sem distinção tipa permite que código acidentalmente compare cursors com URLs ou faça `JSON.parse(cursor)` esperando estrutura. Branded type elimina essa classe de bug em compile time.
- **RFC 5988 / 8288 são specs estáveis** — parser pode ser implementado em puro TypeScript sem dependência runtime; tooling existente (`parse-link-header` npm) é leve mas adiciona supply-chain risk e ~3KB. Para um parser de header limitado em escopo, manutenção própria é trivial.
- **Frente 4 entrega só a foundation** — atualização do `DataTable` para auto-emitir `loadNext(cursor)` e features de Editais consumindo paginação ficam para Frentes 6+. A Frente 4 entrega helpers reutilizáveis em `libs/shared-core/src/lib/http/`.

## Opções consideradas

- **A. Helpers explícitos no caller (`parseLink` + `extractNextCursor` + `Cursor` branded type), interceptor intocado.** Caller chama `extractNextCursor(result.headers.get('Link'))` quando precisa seguir paginação; tipo `Cursor` carrega o branding mas é serializado como string opaca em URLs.
- **B. Auto-detecção no `apiResultInterceptor` (heurística "array body + Link header presente") — emite `ApiResult<PaginatedResponse<T>>` automaticamente.** Caller recebe envelope diferente sem opt-in.
- **C. Operator RxJS `toPaginated<T>()` que envelopa `ApiResult<T[]>` em `PaginatedResponse<T>` lazy.** Caller compõe explicitamente: `editaisApi.listar().pipe(toPaginated())`.
- **D. Dependência externa `parse-link-header` npm.** Parser pronto, ~3KB gzipped.

## Resultado da decisão

**Escolhida:** "A — Helpers explícitos no caller; interceptor intocado", porque é a única opção que:

1. **Preserva o contrato de saída do `apiResultInterceptor`** (sempre `ApiResult<T>` onde `T` é exatamente o tipo gerado pelo codegen). Type narrowing por `result.ok` continua o pattern único.
2. **Mantém a opacidade do cursor compile-time** via branded type. Atribuir `string` arbitrária a `Cursor` requer cast explícito (`createCursor(value)` factory), o que torna o intent visível em PR review.
3. **Não introduz heurística** que falha em edge cases (ex.: endpoint legacy que retorna array sem `Link`, ou endpoint paginado por offset que retorna `Link` por outro motivo).
4. **Cobre o uso real** com 2 funções pequenas e 1 tipo — o caller que precisa de paginação chama em 1 linha.

Operator RxJS (C) pode ser **adicionado depois** sem reescrever os helpers — `toPaginated()` seria fino sobre `parseLink` + `extractNextCursor`. Fica parqueado para quando o boilerplate em consumers crescer (atualmente: zero consumers).

### Forma dos helpers

```ts
// libs/shared-core/src/lib/http/link-header.ts

export type ParsedLink = {
  readonly uri: string;
  readonly params: Record<string, string>;
};

/**
 * Parser RFC 5988/8288 puro. Retorna Map indexada pelo `rel` parameter.
 * Suporta múltiplos rels, params com aspas escapadas, URL com query string.
 * Rel ausente: entrada não é incluída no Map.
 */
export function parseLink(headerValue: string | null | undefined): Map<string, ParsedLink>;
```

```ts
// libs/shared-core/src/lib/http/pagination.ts

declare const cursorBrand: unique symbol;
export type Cursor = string & { readonly [cursorBrand]: true };

/** Wraps a string as Cursor (compile-time only). Sem validação de conteúdo — o servidor é a única autoridade. */
export function createCursor(value: string): Cursor;

/** Serializa Cursor de volta para string (idempotente: Cursor já é string em runtime). */
export function cursorToString(cursor: Cursor): string;

/**
 * Extrai o cursor de `rel="next"` do header Link.
 * Retorna null se: header ausente/vazio, sem rel="next", ou rel="next" sem query param `cursor=`.
 */
export function extractNextCursor(linkHeader: string | null | undefined): Cursor | null;
```

### Uso esperado pelo caller (preview da Frente 6)

```ts
this.editaisApi.listar(this.cursor()).subscribe(result => {
  if (!result.ok) return;
  this.editais.update(prev => [...prev, ...result.data]);
  this.cursor.set(extractNextCursor(result.headers.get('Link')));
});
```

### Esta ADR não decide

- **Implementação do `DataTable`** com auto-paginação por scroll/botão "carregar mais" — Frente 6.
- **Operator RxJS `toPaginated()`** — parqueado; reabre se boilerplate em consumers crescer.
- **Cache de páginas anteriores** (back navigation) — fora de escopo; cada feature decide se mantém ou refaz fetch.
- **Estado UI de paginação** (loading/empty/error) — Frente 6 codifica pattern reusável quando a primeira lista paginada existir.

### Por que B, C e D foram rejeitadas

- **B (auto-detect no interceptor).** Heurística "array + Link" falha em casos legítimos (ex.: endpoint que retorna lista de subitens de outro recurso e usa Link para `rel="related"`, sem ser paginado). Pior: muda silentemente o tipo de retorno do `apiResultInterceptor` — caller que esperava `ApiResult<Edital[]>` recebe `ApiResult<PaginatedResponse<Edital>>` sem se inscrever explicitamente.
- **C (operator RxJS).** Boa ideia, mas prematura. Sem consumers reais (Frente 4 é só foundation), o operator codifica um pattern que ainda não tem feedback de uso. Adicionável depois sobre os mesmos helpers.
- **D (`parse-link-header` npm).** O parser de `Link` é trivial (~50 linhas TS); biblioteca externa adiciona supply-chain risk + bundle weight para zero ganho funcional. RFC 5988 é estável desde 2010.

## Consequências

### Positivas

- **Tipo `Cursor` opaco compile-time** — impossível atribuir string arbitrária sem cast explícito; alinhamento perfeito com ADR-0031 do backend.
- **Helpers leves, sem dep runtime** — parser puro TypeScript; bundle weight ~zero.
- **Caller declarativo** — quando uma feature precisa paginar, fica óbvio no código (vs heurística mágica do interceptor).
- **`apiResultInterceptor` mantém contrato único** — todo consumer continua tratando `ApiResult<T>` da mesma forma.

### Negativas

- **Boilerplate por chamada** — caller que pagina chama `extractNextCursor()` em cada response. Aceitável agora (1 linha); se crescer, operator RxJS C resolve sem reescrever.
- **Maintenance do parser próprio** — RFC 5988 é estável mas edge cases (escape de aspas, params sem aspas) precisam testes próprios. Coberto pela Vitest da Story de implementação.

### Neutras

- **Branded type via `unique symbol`** — pattern idiomático em TypeScript moderno; familiar para devs que já leram Effect, fp-ts ou ts-essentials. Tooling de IDE entende o branding e mostra "Cursor" hover correto.

## Confirmação

1. **Suíte Vitest da Story de implementação** cobre: header com 1 rel, multi-rel, params com aspas escapadas, URL com query string complexa, header ausente/vazio, `rel="next"` sem `cursor=` query param. Mínimo 6 cenários.
2. **PR review** rejeita uso de `string` cru onde `Cursor` for esperado (ESLint regra futura ou code review humano).
3. **Frente 6 (Editais lista)** consome `extractNextCursor` em smoke E2E ponta-a-ponta — valida o helper em runtime contra o backend real após sync da #187.

## Mais informações

- [ADR-0026 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0026-paginacao-cursor-opaco-cifrado.md) — wire format do cursor opaco + `Link` header.
- [ADR-0031 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0031-decoding-de-cursor-opaco-no-boundary-http.md) — decode server-side no boundary; cliente jamais decifra.
- [PR uniplus-api#333](https://github.com/unifesspa-edu-br/uniplus-api/pull/333) — fix do schema OpenAPI que descrevia `AfterId/Limit` em vez de `cursor/limit` (mergeado).
- [PR uniplus-web#188](https://github.com/unifesspa-edu-br/uniplus-web/pull/188) — sync do baseline regenerado (mergeado).
- [ADR-0011](0011-consumer-adapter-api-result.md) + [ADR-0012](0012-placement-api-result-em-shared-core.md) — placement em `libs/shared-core/src/lib/http/`.
- [ADR-0013](0013-gerador-openapi-node-only.md) + [ADR-0014](0014-idempotency-key-cliente-via-http-context.md) — pattern de helpers HTTP-derivados na chain.
- [RFC 5988](https://www.rfc-editor.org/rfc/rfc5988.html) / [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html) — Web Linking.
- [TypeScript branded types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-9.html#unique-symbol) — `unique symbol` desde 2.9.
- Plano Frontend Milestone B (Frente 4) — `~/.claude/plans/novo-plano-para-implementar-glistening-petal.md`.

## Implementação (2026-05-06)

A entrega da Story [#191](https://github.com/unifesspa-edu-br/uniplus-web/issues/191) materializa a decisão. Status promovido de `proposed` para `accepted` no merge.

### Arquivos criados/modificados

- `libs/shared-core/src/lib/http/link-header.ts` (criado) — parser RFC 5988/8288 puro TypeScript: `parseLink(headerValue): Map<rel, ParsedLink>`. Tokenizer char-by-char preserva vírgulas e ponto-e-vírgulas dentro de quoted-strings (com escape `\\`). Suporta `rel="self next"` (RFC 5988 §5.3.1) registrando uma entrada por valor. Param keys são lowercased.
- `libs/shared-core/src/lib/http/pagination.ts` (criado) — `Cursor` branded type via `unique symbol`; `createCursor(value: string): Cursor`; `cursorToString(cursor: Cursor): string`; `extractNextCursor(linkHeader): Cursor | null` consome `parseLink` e extrai o valor do query param `cursor=` da URI do `rel="next"`. Decode percent-encoded values com fallback a `null` em malformed.
- `libs/shared-core/src/lib/http/link-header.spec.ts` (criado) — 22 cenários cobrindo: header ausente/vazio (4), 1 link-value (3), múltiplos link-values (3), `rel` multi-valor (1), aspas/ponto-e-vírgula/vírgula escapadas em quoted-string (3), formas defensivas (5).
- `libs/shared-core/src/lib/http/pagination.spec.ts` (criado) — 19 cenários cobrindo: branded type (3), happy paths de `extractNextCursor` (6), retornos `null` legítimos (5), formas defensivas (5).
- `libs/shared-core/src/lib/http/index.ts` (atualizado) — re-exporta `parseLink`, `ParsedLink`, `createCursor`, `cursorToString`, `extractNextCursor`, `Cursor`.

### Pontos não-óbvios capturados na implementação

- **`rel="next"` sem `cursor=` retorna `null`** em vez de `Cursor` com string vazia. Justificativa: um `rel="next"` que não carrega cursor opaco é defeituoso server-side; tratá-lo como ausência preserva a invariante "cliente nunca decide o cursor".
- **`decodeURIComponent` envelopado em try/catch** — servidor mandando `%2` ou `%XY` lança `URIError`; convertemos para `null` em vez de propagar exception ao consumer.
- **Quando dois link-values declaram o mesmo `rel`, o primeiro vence.** RFC 5988 não proíbe duplicatas mas também não define semântica; escolhemos determinismo previsível.
- **Hash fragment (`#...`) é descartado** ao extrair query string — embora paginação por cursor não use fragment, ser defensivo evita bug se algum endpoint futuro emitir.
- **Branded type em runtime é apenas string** — `JSON.stringify(cursor)` funciona, comparação `cursor === otherCursor` funciona; o branding só vive no compile time. Isso é desejável: serialização para query param/storage transparente.

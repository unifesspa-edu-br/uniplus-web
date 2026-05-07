---
status: "accepted"
date: "2026-05-06"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0016: Vendor MIME consumer via `HttpContext` — `withVendorMime` declara o recurso e o `apiResultInterceptor` anexa `Accept`

## Contexto e enunciado do problema

A `uniplus-api` adotou versionamento per-resource via content negotiation, descrito na [ADR-0028 do backend](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0028-versionamento-per-resource-content-negotiation.md). Cada recurso (Edital, Inscrição, Recurso, Classificação) evolui em cadência independente; clientes declaram a versão pretendida no header `Accept` com vendor media type no formato `application/vnd.uniplus.<resource>.v<N>+json`. URLs ficam limpas (sem `/v1/` no path), e o servidor responde `406 Not Acceptable` com extensão `available_versions` quando a versão pedida não existe.

Do lado do `uniplus-web`, surge uma pergunta operacional concreta: **onde** mora a lógica que monta esse header e **como** o caller declara que um GET é versionado. Antes desta decisão, services hipotéticos teriam que montar `Accept` à mão a cada chamada (`http.get(url, { headers: { Accept: 'application/vnd.uniplus.edital.v1+json' } })`) — repetição manual com risco alto de typos silenciosos (um header errado retorna 406 e o usuário vê erro genérico em vez de a UI funcionar).

A ADR-0011 + ADR-0012 já consolidaram que o ponto único de adaptação HTTP-cliente vive em `libs/shared-core/src/lib/http/`, e a ADR-0014 (Idempotency-Key) estabeleceu o pattern de declaração via `HttpContext` lido pelo `apiResultInterceptor`. Esta ADR formaliza retroativamente que `withVendorMime` segue o mesmo pattern — entregue na F1 do plano Frontend Milestone B (PR [#176](https://github.com/unifesspa-edu-br/uniplus-web/pull/176)) e em produção desde 2026-05-05.

## Drivers da decisão

- **Conformidade com [ADR-0028 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0028-versionamento-per-resource-content-negotiation.md)** — backend rejeita requisições sem o vendor MIME correspondente com 406 + `available_versions`.
- **Pattern simétrico com `withIdempotencyKey` (ADR-0014)** — ambos os helpers retornam `HttpContext` populado com tokens; o `apiResultInterceptor` é o **único leitor** dessa chain (`appendContextHeaders`). Manter um único leitor reduz acoplamento e elimina ambiguidade sobre "quem anexa o header".
- **Caller declarativo via tipo, não via string concatenada** — o helper recebe `(resource: string, version: number)`, valida ambos e devolve `HttpContext`. Erros (resource vazio, version não-inteira ou < 1) viram `Error` em build/test, não 406 silencioso em runtime.
- **Compatível com [RFC 9110 §12 (Content Negotiation)](https://www.rfc-editor.org/rfc/rfc9110#section-12)** — `Accept` é o mecanismo padrão; o servidor escolhe a representação mais adequada; vendor media types são uma convenção IANA aceita.
- **Sem dependência runtime adicional** — implementação é uma função pura + um `HttpContextToken`; bundle weight ≈ zero.
- **Composição com outros tokens é trivial** — `HttpContext` expõe `.set(token, value)`, então `withVendorMime('edital', 1).set(IDEMPOTENCY_KEY_TOKEN, key)` funciona nativamente.

## Opções consideradas

- **A. Helper `withVendorMime(resource, version)` populando `VENDOR_MIME_TOKEN`; `apiResultInterceptor` (já existente) anexa o header.** Simétrico com `withIdempotencyKey`.
- **B. String literal por chamada — caller monta o header `Accept` à mão em `HttpHeaders`.** Sem helper, sem token, sem validação central.
- **C. Decorator/marker em métodos de service (ex.: `@AcceptsVersion('edital', 1)`); interceptor inspeciona metadata via reflection.** Requer reflection runtime ou tooling de transformação.
- **D. Interceptor dedicado (`vendor-mime.interceptor.ts`) separado do `apiResultInterceptor`.** Funciona, mas duplica o pattern "ler `HttpContext` e anexar header".
- **E. Configuração global por cliente API gerado (ex.: factory que injeta versão por recurso no construtor).** Acopla versão ao codegen; mudar versão de um recurso exige regenerar binding.

## Resultado da decisão

**Escolhida:** "A — `withVendorMime(resource, version)` + `apiResultInterceptor` consolida a anexação", porque é a única opção que:

1. Mantém **simetria com `withIdempotencyKey`** — mesma forma de declaração, mesmo leitor de tokens, mesmo ponto de extensão para futuros headers HTTP-derivados.
2. Não introduz reflection/decorator custom (C) e não polui a chain com interceptor extra (D).
3. **Valida em build/test** (resource vazio, version inválida) — opção B silenciaria typos até produção.
4. Desacopla **versão de recurso** de **codegen** (E acoplaria) — bumps de versão são um header, não regen de cliente.

### Forma do helper

```ts
// libs/shared-core/src/lib/http/vendor-mime.ts

export interface VendorMimeDeclaration {
  readonly resource: string;
  readonly version: number;
}

export const VENDOR_MIME_TOKEN = new HttpContextToken<VendorMimeDeclaration | null>(() => null);

export function withVendorMime(resource: string, version: number): HttpContext {
  if (!resource || !Number.isInteger(version) || version < 1) {
    throw new Error(
      `withVendorMime: resource não pode ser vazio e version deve ser inteiro >= 1 ` +
      `(recebido resource="${resource}", version=${version}).`,
    );
  }
  return new HttpContext().set(VENDOR_MIME_TOKEN, { resource, version });
}

export function buildVendorMimeAccept(resource: string, version: number): string {
  return `application/vnd.uniplus.${resource}.v${version}+json`;
}
```

### Composição com outros tokens

```ts
const ctx = withVendorMime('edital', 1).set(IDEMPOTENCY_KEY_TOKEN, idempotencyKey.create());
http.post('/api/editais', body, { context: ctx });
```

### Comportamento do `apiResultInterceptor`

O interceptor já consome `VENDOR_MIME_TOKEN` em `appendContextHeaders` (mesma função que lê `IDEMPOTENCY_KEY_TOKEN`):

```ts
const vendorMime = req.context.get(VENDOR_MIME_TOKEN);
if (vendorMime) {
  headers['Accept'] = buildVendorMimeAccept(vendorMime.resource, vendorMime.version);
}
```

Sem efeito quando o token não está populado — endpoints sem versionamento (ex.: health check) não são tocados. **Caller é a autoridade** sobre se o GET é versionado.

### Esta ADR não decide

- **Estratégia de bumps de versão no consumer** — quando a `uniplus-api` lança `edital.v2`, qual é o protocolo de migração no frontend? Fica para ADR futura quando o cenário existir (V1 ainda nem foi para HML).
- **Tratamento UX de 406** — `problem-i18n.service.ts` já mapeia o code `uniplus.api.versao_nao_suportada`; cada feature decide se mostra fallback, modal ou redirect. Essa ADR não codifica.
- **Vendor MIME em POST/PUT** — backend espera `Content-Type: application/vnd.uniplus.<resource>.v<N>+json` no body de mutação? ADR-0028 backend descreve `Accept` no GET; a simetria em mutação é responsabilidade da próxima ADR quando a primeira mutação versionada existir.

### Por que B, C, D e E foram rejeitadas

- **B (string literal por chamada).** Cada caller responsável por montar o header — typos viram 406 em produção. Sem ponto único de validação. Não escala quando o número de services cresce.
- **C (decorator com reflection).** Requer reflection runtime ou tooling de transformação; conflita com Angular standalone idiomático. Sem ganho real sobre o helper funcional A.
- **D (interceptor separado).** Duplica o pattern "ler `HttpContext` e anexar header" sem benefício. Aumenta a chain por motivo cosmético.
- **E (versão fixa no codegen).** Acopla versão à etapa de geração — alterar versão exige rerodar codegen. ADR-0013 já consolidou que codegen é Node-only; introduzir versão por recurso ali contamina o pipeline com uma decisão que pertence ao caller.

## Consequências

### Positivas

- **Pattern unificado para headers HTTP-derivados** — vendor MIME e idempotência saem do mesmo lugar; futuros tokens (ex.: `X-Tenant-Id`, trace context) seguem a mesma forma.
- **Caller declarativo** — fica óbvio em cada service qual GET é versionado.
- **Validação centralizada** — typos viram exceção em test/build, não 406 em runtime.
- **Bundle weight zero** — implementação é função + token.

### Negativas

- **Acoplamento implícito caller↔interceptor.** Um caller que use `withVendorMime()` confia que o interceptor está registrado; se algum app esquecer o wiring (improvável — interceptor único na chain), o header não é anexado e o backend retorna 406. Mitigação: smoke E2E com vendor MIME (Frente 9) detecta.
- **Dois pontos de verdade** sobre o formato do media type — `withVendorMime` valida o input mas a string final é construída em `buildVendorMimeAccept`. Mudar o prefixo `application/vnd.uniplus.` exige tocar dois lugares. Mitigação: `buildVendorMimeAccept` é a única source-of-truth do formato; o helper só valida inputs.

### Neutras

- **Validação somente em `withVendorMime`, não em `buildVendorMimeAccept`.** O builder é low-level e usado pelo interceptor com inputs já validados; chamar direto é responsabilidade de quem chama (caso raro — não documentamos como API pública).

## Confirmação

1. **Suíte Vitest** em `libs/shared-core/src/lib/http/vendor-mime.spec.ts` cobre: formato canônico (`application/vnd.uniplus.edital.v1+json`), token populado pelo helper, default `null`, rejeição de resource vazio + version 0/-1/1.5.
2. **Suíte Vitest** em `libs/shared-core/src/lib/http/api-result.interceptor.spec.ts` cobre: header `Accept` injetado quando token populado, ausente quando não, composição com `IDEMPOTENCY_KEY_TOKEN` no mesmo `HttpContext`.
3. **PR review** rejeita services novos que façam `GET` em recurso versionado sem usar `withVendorMime()`.
4. **Smoke E2E ponta-a-ponta autenticado** (Frente 9 do plano) consome `GET /api/editais` com vendor MIME e valida o header em runtime contra a `uniplus-api` real.

## Mais informações

- [ADR-0028 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0028-versionamento-per-resource-content-negotiation.md) — versionamento per-resource via content negotiation (servidor).
- [RFC 9110 §12 — HTTP Content Negotiation](https://www.rfc-editor.org/rfc/rfc9110#section-12) — semântica do `Accept` e seleção de representação.
- [MDN — Accept header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept) — referência prática do mecanismo.
- [ADR-0011](0011-consumer-adapter-api-result.md) + [ADR-0012](0012-placement-api-result-em-shared-core.md) — placement do helper em `libs/shared-core/src/lib/http/`.
- [ADR-0014](0014-idempotency-key-cliente-via-http-context.md) — pattern simétrico para `Idempotency-Key`; mesma forma de declaração via `HttpContext`.
- [ADR-0013](0013-gerador-openapi-node-only.md) — codegen Node-only; vendor MIME desacoplado do codegen.
- [PR uniplus-web#176](https://github.com/unifesspa-edu-br/uniplus-web/pull/176) — entrega original do helper na F1 do Milestone B.
- [Issue uniplus-web#194](https://github.com/unifesspa-edu-br/uniplus-web/issues/194) — Story que originou esta ADR retroativa (F5 do Milestone B).

## Implementação (2026-05-05, retroativa pela F5 — 2026-05-06)

A entrega original veio na PR [#176](https://github.com/unifesspa-edu-br/uniplus-web/pull/176) (F1 — `ApiResult<T>` foundation), antes desta ADR existir. A formalização retroativa documenta a decisão sem alterar código já em produção; status `accepted` direto (não passa por `proposed`) reflete que a implementação já é binding.

### Arquivos relevantes (já em `main`)

- `libs/shared-core/src/lib/http/vendor-mime.ts` — `VENDOR_MIME_TOKEN`, `withVendorMime(resource, version)`, `buildVendorMimeAccept(resource, version)`.
- `libs/shared-core/src/lib/http/api-result.interceptor.ts` — `appendContextHeaders` lê `VENDOR_MIME_TOKEN` e anexa `Accept`.
- `libs/shared-core/src/lib/http/vendor-mime.spec.ts` — 4 cenários cobrindo formato, token populado, default null, validação de inputs.
- `libs/shared-core/src/lib/http/index.ts` — re-exporta `VENDOR_MIME_TOKEN`, `withVendorMime`, `buildVendorMimeAccept`, `VendorMimeDeclaration`.

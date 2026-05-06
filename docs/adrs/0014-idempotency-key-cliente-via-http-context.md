---
status: "proposed"
date: "2026-05-05"
decision-makers:
  - "Tech Lead (CTIC)"
---

# ADR-0014: Idempotency-Key cliente via `HttpContext` + UUID v7, anexado pelo `apiResultInterceptor`

## Contexto e enunciado do problema

A `uniplus-api` adotou o header `Idempotency-Key` como **opt-in por endpoint** (ADR-0027): controllers marcados com `[RequiresIdempotencyKey]` (ex.: `POST /api/editais`, `POST /api/editais/{id}/publicar`) **rejeitam** requisições sem o header retornando `400 uniplus.idempotency.key_ausente`. Replays válidos com a mesma key + body idêntico recebem a resposta original cacheada com `Idempotency-Replayed: true`. O comportamento segue o draft IETF `idempotency-key-header-07`: key 1-255 ASCII printable, sem `,` nem `;`.

O `uniplus-web` ainda não emite esse header em lugar nenhum. Quando os primeiros services `POST` consumirem o contrato V1 (ex.: `EditaisApi.criar()` na Frente 7 do plano frontend Milestone B), eles serão rejeitados pelo backend até existir um helper consolidado para gerar e anexar a key.

A questão é **onde** mora a lógica e **como** o caller declara que um endpoint precisa de idempotência.

## Drivers da decisão

- **Conformidade com [ADR-0027 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0027-idempotency-key-opt-in.md)** — header obrigatório em endpoints decorados; ausência retorna `400`.
- **Pattern simétrico com vendor MIME (ADR-0028 do backend) já entregue na F1** — `withVendorMime(resource, version)` retorna `HttpContext` populado e o `apiResultInterceptor` lê esse token e anexa `Accept`. Repetir o mesmo pattern para `Idempotency-Key` mantém **um único leitor de `HttpContext`** na chain HTTP.
- **Geração via UUID v7 (RFC 9562)** — timestamp-prefixed e ordering-stable; satisfaz o draft IETF (1-255 ASCII printable); facilita debug em logs cronológicos.
- **Stack 100% Node — preferir biblioteca battle-tested** sobre implementação manual; `uuid@^11` mantém `v7()` canônico.
- **Form-scoped key, não submit-scoped** — replay em retry de submit deve preservar a mesma key (única forma de o backend reconhecer como replay e devolver a resposta cacheada). Caller tipicamente gera a key uma vez na inicialização do form e reusa até sucesso ou cancelamento explícito.
- **Sem reflection nem decorators custom** — Angular standalone idiomático: helper funcional + `HttpContext`.

## Opções consideradas

- **A. Helper `withIdempotencyKey(key?)` populando `IDEMPOTENCY_KEY_TOKEN`; `apiResultInterceptor` (já existente) anexa o header.** Simétrico com vendor MIME.
- **B. Decorator/marker em métodos de service (ex.: `@RequiresIdempotency()`); interceptor inspeciona metadata e gera key.** Requer reflection ou tooling auxiliar (ex.: `Reflect.metadata`), conflita com o pattern declarativo standalone.
- **C. Header sempre setado em todo `POST`/`PUT`/`PATCH`** independentemente de o endpoint exigir. Over-injection; carrega cost no caller que não precisa.
- **D. Interceptor dedicado (`idempotency.interceptor.ts`) separado do `apiResultInterceptor`.** Funciona, mas duplica o pattern "ler `HttpContext` e anexar header" em mais um arquivo; chain de interceptors fica mais longa por motivo cosmético.

## Resultado da decisão

**Escolhida:** "A — `withIdempotencyKey(key?)` + `apiResultInterceptor` consolida a anexação", porque é a única opção que:

1. Mantém **simetria com `withVendorMime`** já entregue (mesma forma de declaração via `HttpContext`, mesmo leitor de tokens).
2. Não introduz reflection/decorator custom (B) e não polui chain com interceptor extra (D).
3. Não força over-injection (C) — só endpoints declarados por seus services consomem o token.
4. Permite **form-scoped key** trivial: caller guarda `idempotencyKey.create()` em `signal` ou `field` e reusa em retry.

### Forma do helper

```ts
// libs/shared-core/src/lib/http/idempotency.ts

export const IDEMPOTENCY_KEY_TOKEN = new HttpContextToken<string | null>(() => null);

export const idempotencyKey = {
  /** Gera UUID v7 (RFC 9562) — timestamp-prefixed, ordering-stable. */
  create(): string {
    return uuidv7(); // do `uuid@^11`
  },
};

export function withIdempotencyKey(key?: string): HttpContext {
  const finalKey = key ?? idempotencyKey.create();
  validateOrThrow(finalKey); // 1-255 ASCII printable, sem `,` nem `;`
  return new HttpContext().set(IDEMPOTENCY_KEY_TOKEN, finalKey);
}
```

Composição com outros tokens (ex.: vendor MIME) usa o método nativo de `HttpContext`:

```ts
const ctx = withVendorMime('edital', 1).set(IDEMPOTENCY_KEY_TOKEN, idempotencyKey.create());
http.post('/api/editais', body, { context: ctx });
```

### Atualização no `apiResultInterceptor`

O interceptor já lê `VENDOR_MIME_TOKEN` para anexar `Accept`. Ganha um segundo bloco simétrico para `IDEMPOTENCY_KEY_TOKEN` que anexa `Idempotency-Key` quando o token está populado. Sem efeito quando ausente — endpoints sem idempotência não são tocados.

### Validação do header

`withIdempotencyKey` valida a key recebida explicitamente (rejeita vazia, > 255 chars, contendo `,` ou `;`, ou caracteres não-ASCII printable). Keys geradas internamente (UUID v7) são naturalmente válidas — 36 chars hex+hyphens dentro de ASCII printable.

### Form-scoped key strategy (orientação para callers)

Pages que disparam `POST` idempotente devem **gerar a key uma vez na inicialização** e reusá-la enquanto o submit estiver "ativo":

```ts
@Component(...)
export class EditaisCreatePage {
  private readonly idempotencyKeyForSubmit = signal<string>(idempotencyKey.create());

  submit() {
    this.editaisApi
      .criar(this.form.getRawValue(), withIdempotencyKey(this.idempotencyKeyForSubmit()))
      .subscribe(result => {
        if (result.ok) {
          this.idempotencyKeyForSubmit.set(idempotencyKey.create()); // reset após sucesso
          this.router.navigate([...]);
        }
        // result.ok === false: mantém a key — retry vai bater no replay do backend
      });
  }
}
```

Esta orientação **não é enforçada pelo helper** — é responsabilidade do caller. ADRs futuras (ex.: pattern de página de criação) podem codificar.

### Esta ADR não decide

- Comportamento exato do form-scoped key em formulários complexos (ex.: rascunhos persistidos) — fica para a page de cada feature.
- Persistência da key entre reload de browser — explicitamente fora de escopo (memory-only no `signal`/component field; **nunca** em `localStorage`/`sessionStorage` por aderência ao padrão #20).
- Retry policy automática (cliente refazendo POST após network error) — fora de escopo; caller decide se chama `submit()` de novo.

### Por que B, C e D foram rejeitadas

- **B (decorator).** Requer reflection runtime ou tooling de transformação; conflita com Angular standalone "tudo é função". Sem ganho real sobre o helper funcional A.
- **C (header sempre).** Over-injection: o backend ignora o header em endpoints sem `[RequiresIdempotencyKey]`, mas o caller paga custo de I/O e os logs vêm sujos com keys irrelevantes. Pior, mascara o intent do caller (qual endpoint precisa? não dá pra saber lendo o code).
- **D (interceptor separado).** Duplica o pattern "ler `HttpContext` e anexar header" sem benefício. Aumenta a chain sem motivo. Se um dia idempotência precisar de lógica de retry interno, refactor para interceptor próprio é mecânico — sem lock-in.

## Consequências

### Positivas

- **Pattern unificado para headers derivados de `HttpContext`** — vendor MIME e idempotency saem do mesmo lugar; futuros (`X-Tenant-Id`, etc.) seguem a mesma forma.
- **Caller declarativo** — fica óbvio em `editais-create.page.ts` qual submit precisa de idempotência.
- **UUID v7 canônico** — debug e correlação cronológica diretos a partir da key (timestamp-prefixed).
- **Form-scoped key** sai do guidance da ADR e vira pattern reusável em futuras pages.

### Negativas

- **Acoplamento implícito caller↔interceptor.** Um caller que use `withIdempotencyKey()` confia que o interceptor está registrado; se algum app esquecer o wiring (improvável, é um interceptor único na chain), o header não é anexado e o backend retorna `400`. Mitigação: testes E2E de POST com idempotência (Frente 9) detectam.
- **`uuid@^11` adiciona ~10KB ao bundle** (gzipped). Aceitável para a estabilidade que entrega; alternativa de implementar v7 manualmente economiza pouco e perde manutenção.

### Neutras

- **Validação no helper apenas para keys explícitas.** Keys geradas internamente sempre passam — sem custo.

## Confirmação

1. **Suíte Vitest** cobre geração (UUID v7 válido), replay com mesma key, validação de keys malformadas, e injeção do header pelo `apiResultInterceptor` (presente quando declarado, ausente quando não).
2. **PR review** rejeita services novos que façam `POST` idempotente (verificável pela presença de `[RequiresIdempotencyKey]` no controller backend correspondente) sem usar `withIdempotencyKey()`.
3. **Smoke E2E autenticado** (Frente 9 do plano) cria edital e replays com mesma key, verificando `Idempotency-Replayed: true` no header da resposta.

## Mais informações

- [ADR-0027 do `uniplus-api`](https://github.com/unifesspa-edu-br/uniplus-api/blob/main/docs/adrs/0027-idempotency-key-opt-in.md) — comportamento server-side opt-in.
- [draft-ietf-httpapi-idempotency-key-header-07](https://www.ietf.org/archive/id/draft-ietf-httpapi-idempotency-key-header-07.html) — semântica do header e formato da key.
- [RFC 9562 — UUID](https://www.rfc-editor.org/rfc/rfc9562.html) — versão 7.
- [`uuid` npm](https://www.npmjs.com/package/uuid) — v11 com `v7()` exportado.
- [ADR-0011](0011-consumer-adapter-api-result.md) + [ADR-0012](0012-placement-api-result-em-shared-core.md) — placement do helper em `libs/shared-core/src/lib/http/`.
- ADR-0028 do `uniplus-api` (vendor MIME) — pattern simétrico já entregue na F1 (PR #176).
- Plano Frontend Milestone B (Frente 3) — implementação que consome esta decisão (Story #184).

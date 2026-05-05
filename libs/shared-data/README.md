# `@uniplus/shared-data`

Lib de dados do `uniplus-web`: DTOs, validators, utilitários de domínio (CPF, datas) e **clientes Angular tipados** dos contratos V1 expostos pela `uniplus-api`.

## Estrutura

```text
libs/shared-data/
├── openapi/                       # baselines OpenAPI 3.1 (sincronizados de uniplus-api)
│   ├── selecao.openapi.json
│   └── ingresso.openapi.json
├── scripts/
│   └── generate-api-clients.sh   # codegen openapi-typescript (Node-only, ADR-0013)
└── src/lib/
    ├── api/                       # clientes do contrato V1
    │   ├── selecao/
    │   │   ├── schema.ts          # GERADO — paths + components do módulo Seleção
    │   │   ├── tokens.ts          # SELECAO_BASE_PATH InjectionToken
    │   │   ├── editais.api.ts     # service Angular thin
    │   │   └── *.spec.ts
    │   └── ingresso/
    │       ├── schema.ts
    │       └── tokens.ts
    ├── models/                    # DTOs canônicos do projeto (não gerados)
    ├── utils/                     # cpf.util, date.util
    └── validators/                # cpfValidator (Reactive Forms)
```

## Padrão dos services

Os services Angular são **escritos manualmente** e thin (~30 LOC cada). Pattern canônico (referência: `editais.api.ts`):

```ts
@Injectable({ providedIn: 'root' })
export class FooApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH); // ou INGRESSO_BASE_PATH

  listar(): Observable<ApiResult<readonly FooDto[]>> {
    return this.http.get<ApiResult<readonly FooDto[]>>(
      `${this.basePath}/api/foos`,
      { context: withVendorMime('foo', 1) },
    );
  }
}
```

Onde:

- `FooDto` vem de `components['schemas']['FooDto']` em `schema.ts` (gerado).
- `ApiResult<T>` envolve a response (sucesso ou falha) — produzido pelo `apiResultInterceptor` (ADR-0011).
- `withVendorMime('foo', 1)` injeta `Accept: application/vnd.uniplus.foo.v1+json` (ADR-0028 do `uniplus-api`).
- `SELECAO_BASE_PATH` / `INGRESSO_BASE_PATH` são `InjectionToken<string>` providos uma vez por aplicação em `app.config.ts` a partir de `environment.apiUrl`.
- Bearer é injetado pelo `tokenInterceptor` (ADR-0009) — **nunca** lido manualmente.

**`ProblemDetails`:** o `schema.ts` gerado também declara `components['schemas']['ProblemDetails']` (RFC 7807 default da .NET). **Não use esse tipo.** O wire format real RFC 9457 + extensions Uni+ vive em `@uniplus/shared-core` (ADR-0011 + ADR-0023 do `uniplus-api`).

## Regenerar tipos a partir do contrato

Quando a `uniplus-api` publicar um spec novo:

```bash
# 1. Sincronizar baselines a partir do backend
cp ../uniplus-api/contracts/openapi.selecao.json   libs/shared-data/openapi/selecao.openapi.json
cp ../uniplus-api/contracts/openapi.ingresso.json  libs/shared-data/openapi/ingresso.openapi.json

# 2. Regerar schema.ts dos dois módulos (~40ms)
npx nx run shared-data:codegen-api

# 3. Commitar baselines + schema.ts juntos
git add libs/shared-data/openapi/ libs/shared-data/src/lib/api/{selecao,ingresso}/schema.ts
```

## Drift check em CI

O workflow `.github/workflows/ci.yml` roda `npx nx run shared-data:codegen-api-check` em cada push/PR: regenera os schemas e falha se houver diff contra o committed. Garante que toda mudança no contrato seja refletida em `schema.ts` no mesmo PR.

## Por que `openapi-typescript` em vez de `openapi-generator-cli`

Decisão registrada em [ADR-0013](../../docs/adrs/0013-gerador-openapi-node-only.md). Resumo:

- Sem JRE no CI nem em dev local — stack 100% Node 22.
- Não emite `NgModule` (alinhado com Angular 21 standalone-only — ADR-0002).
- Compatível com `HttpContext` pattern (`withVendorMime`, `withIdempotencyKey` futuro) — services thin manuais reutilizam o que entregamos em `@uniplus/shared-core`.
- Geração instantânea (~40ms total) viabiliza drift check síncrono em pre-commit.
- OpenAPI 3.1 nativo, sem downgrade lossy.

## Comandos úteis

```bash
nx run shared-data:lint            # ESLint da lib
nx run shared-data:vite:test       # Suíte Vitest
nx run shared-data:build           # Build (ng-packagr-lite)
nx run shared-data:codegen-api     # Regen schema.ts (gera arquivos)
nx run shared-data:codegen-api-check  # Regen + diff (falha se drift)
```

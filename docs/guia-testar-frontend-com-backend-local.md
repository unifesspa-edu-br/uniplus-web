# Guia: testar um frontend contra o backend local

Como rodar um app do `uniplus-web` (ex.: `configuracao`, `selecao`) contra as
APIs reais do `uniplus-api` conteinerizadas — autenticando no Keycloak de
desenvolvimento e persistindo dados de verdade.

## 1. Suba o backend com o override `frontend-test`

No repositório `uniplus-api`, suba a stack com os **três** arquivos compose:

```bash
docker compose -f docker-compose.yml \
               -f docker-compose.override.yml \
               -f docker-compose.frontend-test.yml up -d
```

> **Obrigatório.** O `frontend-test.yml` realinha o `Auth__Authority` de todas as
> APIs ao realm **`unifesspa`** — o realm em que os frontends autenticam. O
> override base usa `unifesspa-dev-local`, e sem o realinhamento **toda mutação**
> (POST/PUT/DELETE) responde **401** e o app entra em loop de re-login (o GET de
> lista é `[AllowAnonymous]` e mascara o problema). Detalhes em
> `uniplus-api/CONTRIBUTING.md` § "Testar um frontend contra as APIs conteinerizadas".

## 2. Sirva o app

```bash
npx nx serve configuracao   # http://localhost:4203 (fala direto com a organizacao-api :5263)
npx nx serve selecao        # http://localhost:4200 (via gateway Traefik :5000)
```

A URL e o realm de cada app vêm do `runtime-config.json` (ADR-0021). O app
`configuracao` usa `apiUrl=http://localhost:5263` e o client OIDC
`configuracao-web` no realm `unifesspa`.

## 3. Faça login

Usuário de teste com a role `plataforma-admin` (exigida pelo painel admin):

| Campo | Valor |
|---|---|
| Usuário | `admin` |
| Senha | `E2eTest!123` |

## Sintomas comuns

| Sintoma | Causa | Correção |
|---|---|---|
| Listas carregam, mas salvar dá erro e volta pro login | Realm desalinhado (API em `unifesspa-dev-local`) | Suba com o `frontend-test.yml` (passo 1) |
| `ERR_CONNECTION_REFUSED` em :4203 | Dev server caiu | `npx nx serve configuracao` |
| Redireciona ao Keycloak no meio de uma ação longa | `accessTokenLifespan` curto (300s) | Ampliar para 1800s (opcional — ver CONTRIBUTING do `uniplus-api`) |

## E2E automatizado

As specs visuais (`apps/<app>-e2e/src/specs/*.visual.spec.ts`) **mockam** a API via
`page.route` e não dependem do backend real — rodam com `npx nx e2e <app>-e2e`.
Este guia cobre o teste **manual/exploratório** contra o backend de verdade.

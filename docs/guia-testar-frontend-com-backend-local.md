# Guia: testar um frontend contra o backend local

Como rodar um app do `uniplus-web` (`selecao`, `configuracao`, `ingresso`,
`portal`) contra as APIs reais do `uniplus-api` conteinerizadas — autenticando no
Keycloak de desenvolvimento e persistindo dados de verdade.

## 1. Suba o backend com o override `frontend-test`

No repositório `uniplus-api`, copie o template do override (gitignored) e suba a
stack com os **três** arquivos compose:

```bash
cd repositories/uniplus-api/docker
cp docker-compose.override.example.yml docker-compose.override.yml   # 1ª vez

docker compose -f docker-compose.yml \
               -f docker-compose.override.yml \
               -f docker-compose.frontend-test.yml up -d --build --wait
```

Isso sobe a infra (Postgres/Redis/Kafka/MinIO/Apicurio/Keycloak) + as **3 APIs**
(`uniplus-api` na :5200 — o monólito com os 4 módulos internos; `geo-api` na :5400;
`portal-api` na :5302) + um **gateway Traefik na :5000**.

> **Por que o `frontend-test.yml`?** Ele faz duas coisas obrigatórias:
> 1. **Realinha o `Auth__Authority`** das APIs ao realm **`unifesspa`** — o realm em
>    que os frontends autenticam (clients `*-web`). O override base usa
>    `unifesspa-dev-local`, e sem o realinhamento **toda mutação** (POST/PUT/DELETE)
>    responde **401** e o app entra em loop de re-login (o GET de lista é
>    `[AllowAnonymous]` e mascara o problema).
> 2. **Sobe o gateway na :5000**, que separa o tráfego: `/api/{cidades,estados,cep,
>    logradouros}` → `geo-api`; todo o resto de `/api/` → monólito. É o `apiUrl`
>    único que os apps consomem (espelha o ingress de HML/PROD no uniplus-infra).

## 2. Sirva o app

```bash
cd repositories/uniplus-web
npx nx serve selecao        # http://localhost:4200  (client selecao-web)
npx nx serve ingresso       # http://localhost:4201  (client ingresso-web)
npx nx serve portal         # http://localhost:4202  (client portal-web)
npx nx serve configuracao   # http://localhost:4203  (client configuracao-web)
```

O `apiUrl` e o realm de cada app vêm do `runtime-config.json`
(`apps/<app>/public/assets/`). Todos apontam para o gateway
`apiUrl=http://localhost:5000` e o issuer `http://localhost:8080/realms/unifesspa`.

Os api clients chamam os paths com prefixo de módulo do contrato (ADR-0064) —
`/api/selecao/editais`, `/api/configuracao/campi`, `/api/organizacao/unidades` — e
os de geo sem prefixo (`/api/cidades`, `/api/cep`). O gateway roteia ambos; **não
há reescrita de path** (o shim legado `/api/editais` foi removido).

## 3. Faça login

Usuários do realm `unifesspa` (senha inicial **temporária** — o Keycloak pede para
trocar no primeiro login; basta repetir a mesma senha):

| Usuário | Senha inicial | Papel |
|---|---|---|
| `admin` | `Changeme!123` | `plataforma-admin` (painel admin completo) |
| `gestor` | `Changeme!123` | gestor |
| `avaliador` | `Changeme!123` | avaliador |
| `candidato` | `Changeme!123` | candidato (portal) |

## Sintomas comuns

| Sintoma | Causa | Correção |
|---|---|---|
| Listas carregam, mas salvar dá erro e volta pro login | Realm desalinhado (API em `unifesspa-dev-local`) | Suba com o `frontend-test.yml` (passo 1) |
| `404` em `/api/cidades` ou `/api/cep` | `geo-api` fora do ar ou gateway sem rota geo | Confirme `geo-api` healthy e o `frontend-test.yml` (gateway) no `up` |
| `404` em `/api/{modulo}/...` | Gateway fora do ar (subiu sem o `frontend-test.yml`) | Inclua o `frontend-test.yml` no `up` |
| `ERR_CONNECTION_REFUSED` em :420x | Dev server caiu | `npx nx serve <app>` |
| Redireciona ao Keycloak no meio de uma ação longa | `accessTokenLifespan` curto (300s) | Ampliar para 1800s (opcional — ver CONTRIBUTING do `uniplus-api`) |

## E2E automatizado

As specs visuais (`apps/<app>-e2e/src/specs/*.visual.spec.ts`) **mockam** a API via
`page.route` e não dependem do backend real — rodam com `npx nx e2e <app>-e2e`.
Este guia cobre o teste **manual/exploratório** contra o backend de verdade.

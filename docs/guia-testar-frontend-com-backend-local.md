# Guia: testar um frontend contra o backend local

Como rodar um app do `uniplus-web` (`selecao`, `configuracao`, `ingresso`,
`portal`) contra as APIs reais do `uniplus-api` conteinerizadas — autenticando no
Keycloak de desenvolvimento e persistindo dados de verdade.

## 1. Suba infraestrutura, APIs e gateway

No repositório `uniplus-api`, copie os arquivos locais na primeira execução e
suba apenas a infraestrutura, as APIs e o gateway. O
`docker-compose.override.yml` já contém o realm `unifesspa` consumido pelos
frontends e o Traefik em `:5000`.

```bash
cd repositories/uniplus-api
cp docker/.env.example docker/.env                                    # 1ª vez
cp docker/docker-compose.override.example.yml docker/docker-compose.override.yml   # 1ª vez

docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.override.yml \
               up -d --build postgres redis kafka minio apicurio keycloak \
                 uniplus-api geo-api portal-api traefik
```

Isso sobe a infra (Postgres/Redis/Kafka/MinIO/Apicurio/Keycloak) + as **3 APIs**
(`uniplus-api` na :5200 — o monólito com os 4 módulos internos; `geo-api` na :5400;
`portal-api` na :5302) + um **gateway Traefik na :5000**.

> **Importante:** não execute o `up` sem a lista de serviços quando for usar
> `nx serve`. O override completo também sobe os containers `selecao-web`,
> `ingresso-web`, `portal-web` e `configuracao-web`, que ocupam as portas
> 4200–4203 usadas pelo hot reload.

## 2. Sirva o app

```bash
cd repositories/uniplus-web
npm ci                            # primeira vez ou após alteração do lockfile
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

| Usuário     | Senha inicial  | Papel                                      |
| ----------- | -------------- | ------------------------------------------ |
| `admin`     | `Changeme!123` | `plataforma-admin` (painel admin completo) |
| `gestor`    | `Changeme!123` | gestor                                     |
| `avaliador` | `Changeme!123` | avaliador                                  |
| `candidato` | `Changeme!123` | candidato (portal)                         |

## Sintomas comuns

| Sintoma                                               | Causa                                                              | Correção                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Listas carregam, mas salvar dá erro e volta pro login | APIs não foram iniciadas com o override atual do realm `unifesspa` | Refaça o passo 1 com os dois arquivos compose e a lista de serviços    |
| Catálogos carregam, mas toda escrita responde `401`   | API subida com `docker-compose.smoke.yml`, que valida o realm `unifesspa-dev-local` — leitura de reference data é pública e mascara o problema | `docker inspect docker-uniplus-api-1 ... \| grep -i authority` e recrie a API sem o override de smoke |
| Escrita responde `403` e cai em `/acesso-negado`      | O papel exigido pela rota não está no scope mapping do client no Keycloak, então não chega ao token | Confira `clients/<id>/scope-mappings/realm` na API admin do Keycloak  |
| `404` em `/api/cidades` ou `/api/cep`                 | `geo-api` ou Traefik fora do ar                                    | Confirme ambos os serviços healthy no Compose do passo 1               |
| `404` em `/api/{modulo}/...`                          | Monólito, portal-api ou gateway fora do ar                         | Confirme `uniplus-api`, `portal-api` e `traefik` no Compose do passo 1 |
| `ERR_CONNECTION_REFUSED` em :420x                     | Dev server caiu                                                    | `npx nx serve <app>`                                                   |
| Redireciona ao Keycloak no meio de uma ação longa     | `accessTokenLifespan` curto (300s)                                 | Ampliar para 1800s (opcional — ver CONTRIBUTING do `uniplus-api`)      |

## E2E automatizado

As specs visuais (`apps/<app>-e2e/src/specs/*.visual.spec.ts`) **mockam** a API via
`page.route` e não dependem do backend real — rodam com `npx nx e2e <app>-e2e`.

### Specs contra o backend real

Specs `*.backend.spec.ts` exercitam API, Keycloak e storage de verdade — criam registros e
sobem arquivos. Ficam atrás de `E2E_BACKEND_REAL=1`: sem a variável, o project Playwright
nem é declarado, porque o CI provisiona apenas o Keycloak.

```bash
# 1. Stack do uniplus-api no ar (passo 1 deste guia)
# 2. Libere a porta do redirect do app — o container serve o build antigo nela
docker stop docker-selecao-web-1
npx nx serve selecao --port 4200

# 3. Rode as specs
export KEYCLOAK_ADMIN_PASSWORD=<senha do Keycloak>
E2E_BACKEND_REAL=1 npx nx e2e selecao-e2e -- --project=selecao-backend-real

# 4. Devolva o container ao terminar
docker start docker-selecao-web-1
```

A porta importa: o redirect do client OIDC é fixo por app (`selecao-web` → `:4200`), então
servir em outra porta quebra o login.

Este guia cobre também o teste **manual/exploratório** contra o backend de verdade.

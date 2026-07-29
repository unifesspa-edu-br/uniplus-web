# Tutorial: rodar e testar a aplicação do zero

Guia passo a passo para quem **acabou de baixar os projetos** e quer rodar a
aplicação, **logar nela** e executar os testes (unitários e E2E).

A plataforma tem dois repositórios que sobem juntos:

| Repositório   | Papel                                                        | O que você roda            |
| ------------- | ------------------------------------------------------------ | -------------------------- |
| `uniplus-api` | Backend .NET + infra (PostgreSQL, Keycloak, etc. via Docker) | `docker compose ... up -d` |
| `uniplus-web` | Frontend Angular (Nx)                                        | `npx nx serve <app>`       |

> **Atalho:** se você já tem os repositórios e a infra de pé, use a referência
> rápida em [`guia-testar-frontend-com-backend-local.md`](guia-testar-frontend-com-backend-local.md).
> Este tutorial cobre o fluxo completo desde o clone.

---

## Pré-requisitos

| Ferramenta            | Versão                                        | Verificação              |
| --------------------- | --------------------------------------------- | ------------------------ |
| Docker                | 24+                                           | `docker --version`       |
| Docker Compose        | 2.20+                                         | `docker compose version` |
| .NET SDK              | 10.0                                          | `dotnet --version`       |
| Node.js               | **22** (ver `.nvmrc`)                         | `node --version`         |
| Python 3              | 3.8+ (para os snippets do Keycloak Admin API) | `python3 --version`      |
| Git                   | 2.40+                                         | `git --version`          |
| GitHub CLI (opcional) | 2.50+                                         | `gh --version`           |

> O frontend exige **Node 22** — se você usa `nvm`, rode `nvm use 22` dentro de
> `uniplus-web` (há um `.nvmrc`). Node 24 (default de algumas máquinas) quebra o build.

---

## Passo 1 — Clonar os repositórios

Mantenha os dois lado a lado (a convenção do projeto é uma pasta `repositories/`):

```bash
mkdir -p uniplus/repositories && cd uniplus/repositories
git clone https://github.com/unifesspa-edu-br/uniplus-api.git
git clone https://github.com/unifesspa-edu-br/uniplus-web.git
```

---

## Passo 2 — Subir o backend (APIs + infra + Keycloak)

Num clone fresco, `docker/.env` e `docker/docker-compose.override.yml` **não
existem** (são gitignored) — copie-os dos `.example` primeiro. Depois suba
somente a infraestrutura, as APIs e o gateway. O override atual já configura as
APIs para o realm `unifesspa` e inclui o Traefik que atende o `apiUrl` local.

```bash
cd uniplus-api
cp docker/.env.example docker/.env
cp docker/docker-compose.override.example.yml docker/docker-compose.override.yml

docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.override.yml \
               up -d --build postgres redis kafka minio apicurio keycloak \
                 uniplus-api geo-api portal-api traefik
```

> Setup canônico do backend (mais detalhes): `uniplus-api/docs/setup-ambiente-local.md`.

Isso sobe PostgreSQL, Redis, Kafka, MinIO, **Keycloak** (que importa o realm
`unifesspa` automaticamente), as três APIs (`uniplus-api` em :5200, `geo-api`
em :5400 e `portal-api` em :5302) e o gateway Traefik em :5000.

> **Não suba o override completo** quando quiser hot reload. Ele também inicia
> os containers `selecao-web`, `ingresso-web`, `portal-web` e
> `configuracao-web`, que ocupam 4200–4203. O comando acima deixa essas portas
> livres para o Nx.

Aguarde tudo ficar **healthy**:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml ps
```

> Se as APIs ficarem `unhealthy`, normalmente é o **Keycloak ainda subindo** (o
> health-check `oidc-discovery` depende dele). Aguarde alguns segundos e reveja.

---

## Passo 3 — Servir o frontend

Em outro terminal:

```bash
cd uniplus-web
nvm use 22            # se usar nvm
npm ci                # instala dependências (primeira vez)
npx nx serve configuracao   # painel administrativo  -> http://localhost:4203
```

Cada app lê o backend e o Keycloak do seu `runtime-config.json`. Todas usam o
gateway `http://localhost:5000` e o issuer
`http://localhost:8080/realms/unifesspa`.

| App          | Comando                     | URL                   | Client OIDC        |
| ------------ | --------------------------- | --------------------- | ------------------ |
| Seleção      | `npx nx serve selecao`      | http://localhost:4200 | `selecao-web`      |
| Ingresso     | `npx nx serve ingresso`     | http://localhost:4201 | `ingresso-web`     |
| Portal       | `npx nx serve portal`       | http://localhost:4202 | `portal-web`       |
| Configuração | `npx nx serve configuracao` | http://localhost:4203 | `configuracao-web` |

---

## Passo 4 — Logar na aplicação

Abra **http://localhost:4203** — o app redireciona para o login do Keycloak
(realm `unifesspa`).

O realm já vem semeado com usuários de teste. O `admin` tem a role
`plataforma-admin` (exigida pelo painel). **Porém a senha semeada é temporária**
(`Changeme!123`) — no primeiro login o Keycloak pede para trocá-la.

Para usar uma senha **fixa e conhecida** (`E2eTest!123`, a mesma dos testes E2E),
redefina-a uma vez via Keycloak Admin API:

```bash
KC=http://localhost:8080
TOKEN=$(curl -s "$KC/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli -d username=admin -d password=admin \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
# id do usuário admin no realm unifesspa (UID é read-only no shell; use outro nome)
ADMIN_ID=$(curl -s "$KC/admin/realms/unifesspa/users?username=admin&exact=true" \
  -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')
# define senha permanente
curl -s -X PUT "$KC/admin/realms/unifesspa/users/$ADMIN_ID/reset-password" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"password","value":"E2eTest!123","temporary":false}'
```

Credenciais de login:

| Campo   | Valor                               |
| ------- | ----------------------------------- |
| Usuário | `admin`                             |
| Senha   | `E2eTest!123` (após o reset acima)  |
| Realm   | `unifesspa` (já configurado no app) |

> O admin do **Keycloak** (console em `:8080`) é `admin` / `admin` no realm
> `master` — não confundir com o usuário `admin` da aplicação no realm `unifesspa`.

Logado, você cai no painel. Em **Configuração → Instituição** dá para cadastrar a
Instituição (singleton) e, em **Configuração → Unidade**, a estrutura
organizacional — exercitando o CRUD completo contra o backend real.

---

## Passo 5 — Executar os testes

### Frontend — unitários (Vitest)

```bash
cd uniplus-web
npx nx vite:test configuracao          # um app
npx nx run-many --target=vite:test --all
```

### Frontend — E2E (Playwright)

As specs visuais **mockam a API** via `page.route` — não exigem as APIs de pé,
só o **Keycloak** (o _setup project_ `auth-setup` reseta a senha do usuário de
teste e faz login real). Como o Keycloak já subiu no Passo 2, basta:

```bash
cd uniplus-web
npx playwright install chromium firefox   # baixa os browsers (primeira vez)
KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin \
  npx nx e2e configuracao-e2e
```

> `KEYCLOAK_ADMIN_PASSWORD` é obrigatória: sem ela o `auth-setup` aborta. Num
> clone fresco os browsers do Playwright ainda não estão instalados — daí o
> `npx playwright install`.

(Roda a matriz de temas × viewports. Para um recorte rápido, acrescente
`-- --project=visual-desktop-light <arquivo>.visual.spec.ts`.)

### Backend (opcional)

```bash
cd uniplus-api
dotnet test UniPlus.slnx                         # tudo
dotnet test --filter "Category!=Integration"     # só unitários (sem Docker)
```

---

## Passo 6 — (opcional) sessões manuais longas

O `accessTokenLifespan` do realm é 300s. Para testar manualmente sem refresh
frequente, amplie para 30 min (reverta depois se quiser):

```bash
TOKEN=$(curl -s http://localhost:8080/realms/master/protocol/openid-connect/token \
  -d grant_type=password -d client_id=admin-cli -d username=admin -d password=admin \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -X PUT http://localhost:8080/admin/realms/unifesspa \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"accessTokenLifespan":1800}'
```

---

## Comandos úteis

```bash
# Servir aplicações (uniplus-web; todas usam o gateway Traefik :5000)
npx nx serve selecao          # http://localhost:4200
npx nx serve ingresso         # http://localhost:4201
npx nx serve portal           # http://localhost:4202
npx nx serve configuracao     # http://localhost:4203

# Build
npx nx build configuracao
npx nx run-many --target=build --all

# Testes unitários (Vitest)
npx nx vite:test configuracao
npx nx run-many --target=vite:test --all

# Lint
npx nx lint configuracao
npx nx run-many --target=lint --all

# Testes E2E (Playwright) — exige Keycloak de pé
KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin npx nx e2e configuracao-e2e

# Gerar clients de API a partir do contrato OpenAPI
npm run generate:api

# Grafo de dependências do workspace
npx nx graph

# Affected (o que mudou em relação à base) — usado no CI
npx nx affected --target=build
npx nx affected --target=vite:test

# Backend (uniplus-api) — a partir da raiz do repositório uniplus-api
docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml \
  up -d --build postgres redis kafka minio apicurio keycloak uniplus-api geo-api portal-api traefik
dotnet test UniPlus.slnx                          # todos os testes
dotnet test --filter "Category!=Integration"      # só unitários (sem Docker)
```

---

## Solução de problemas

| Sintoma                                                            | Causa                                                              | Correção                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Listas carregam, mas **salvar dá erro e volta pro login**          | APIs não foram iniciadas com o override atual do realm `unifesspa` | Refaça o Passo 2 com os dois arquivos compose e a lista de serviços |
| `ERR_CONNECTION_REFUSED` em `:4203`                                | Dev server não está rodando                                        | `npx nx serve configuracao`                                         |
| APIs `unhealthy`                                                   | Keycloak ainda subindo / parado                                    | Aguardar; conferir `docker compose ps` do `docker-keycloak-1`       |
| Keycloak pede troca de senha no login                              | Senha semeada é temporária (`Changeme!123`)                        | Resetar para `E2eTest!123` (Passo 4)                                |
| Build do frontend quebra                                           | Node ≠ 22                                                          | `nvm use 22`                                                        |
| E2E falha em `auth-setup` (`KEYCLOAK_ADMIN_PASSWORD não definido`) | Variável ausente                                                   | Prefixar o comando com `KEYCLOAK_ADMIN_PASSWORD=admin`              |
| Redireciona ao Keycloak no meio de uma ação                        | `accessTokenLifespan` curto                                        | Ampliar para 1800s (Passo 6)                                        |

---

## Referências

- `uniplus-api/CONTRIBUTING.md` § "Testar um frontend contra as APIs conteinerizadas"
- `uniplus-web/docs/guia-testar-frontend-com-backend-local.md` (referência rápida)

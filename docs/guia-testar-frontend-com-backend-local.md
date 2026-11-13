# Guia: testar um frontend contra o backend local

Como rodar um app do `uniplus-web` (`selecao`, `configuracao`, `ingresso`,
`portal`) contra as APIs reais do `uniplus-api` conteinerizadas — autenticando no
Keycloak de desenvolvimento e persistindo dados de verdade.

O workspace usa o layout plano: o `uniplus-api` fica ao lado do `uniplus-web`
(`uniplus/uniplus-api/` e `uniplus/uniplus-web/`), sem a pasta `repositories/`.

## 1. Suba infraestrutura, APIs e gateway

No `uniplus-api`, copie os arquivos locais na primeira execução e suba a
infraestrutura, as APIs, os serviços de apoio e o gateway. O
`docker-compose.override.yml` já contém o realm `unifesspa` consumido pelos
frontends e o Traefik em `:5000`.

```bash
cd uniplus-api
cp docker/.env.example docker/.env                                    # 1ª vez
cp docker/docker-compose.override.example.yml docker/docker-compose.override.yml   # 1ª vez

docker compose -f docker/docker-compose.yml \
               -f docker/docker-compose.override.yml \
               up -d --build postgres redis kafka kafka-init minio minio-init \
                 rabbitmq mailpit openldap keycloak clamd-verificador verificador \
                 apicurio uniplus-api geo-api portal-api ambiente-init traefik
```

Isso sobe:

- a infraestrutura: Postgres, Redis, Kafka (com o `kafka-init`, que cria os
  tópicos), MinIO (com o `minio-init`), RabbitMQ, Mailpit, OpenLDAP, Keycloak e
  Apicurio;
- o verificador de documentos (`verificador`) e o antivírus que ele usa
  (`clamd-verificador`): sem eles, nenhum anexo sai de "aguardando verificação";
- as **3 APIs**: `uniplus-api` na :5200 (o monólito com os módulos internos),
  `geo-api` na :5400 e `portal-api` na :5302;
- o `ambiente-init`, que prepara o ambiente (ver o passo 1.1);
- um **gateway Traefik na :5000**.

> **Importante:** não execute o `up` sem a lista de serviços quando for usar
> `nx serve`. O override completo também sobe os containers `selecao-web`,
> `ingresso-web`, `portal-web` e `configuracao-web`, que ocupam as portas
> 4200–4203 usadas pelo hot reload.

Na primeira subida, as migrations de todos os módulos fazem a API demorar a ficar
saudável. Se o `up` terminar com `dependency failed to start` por um serviço ainda
não saudável, repita o mesmo comando sem `--build`: os containers que já estão no
ar são mantidos.

### 1.1 Ordem de preparação da base

Uma base recém-criada precisa desta ordem:

1. **`ambiente-init`**: roda sozinho ao fim do `up`. Ele executa o
   `scripts/setup-keycloak-dev.sh` (personas, senhas e federação LDAP) e instala
   os gestores iniciais (`INSTALAR_GESTORES=true`). Sem ele não há gestor de
   acessos para conceder perfis. Confira que terminou com
   `docker compose ... ps -a ambiente-init` (saída `Exited (0)`).
2. **Serviços no ar**: a API saudável (`/health` em `:5200`) e o gateway
   respondendo em `:5000`.
3. **Roteiro do processo seletivo**: `scripts/roteiro-processo-teste-inscricao.sh`
   monta o cenário de teste (tipos de ato, fases, processo seletivo). Ele só roda
   **depois** do `ambiente-init`, com um operador que já recebeu os perfis de
   cadastro; a preparação das specs reais (`garantirOperadorDoRoteiro`, em
   `@uniplus/shared-e2e`) concede esses perfis.

> **Unidade CEPS (passo manual, até a
> [uniplus-api#2407](https://github.com/unifesspa-edu-br/uniplus-api/issues/2407)):**
> a base nova não traz a unidade `CEPS`, que o roteiro e as specs reais esperam.
> Enquanto a issue não for resolvida, crie a unidade antes das specs, pelo roteiro
> (que a cria no início) ou pela API `POST /api/organizacao/admin/unidades` com
> `sigla` e `codigo` iguais a `CEPS`, como faz a função `criar_unidade` do roteiro.

### 1.2 Portas alternativas

Quando a 8080, a 5000 ou outras já estão ocupadas por outro projeto, mude as
portas só nos arquivos locais, que não são versionados:

- no `docker/.env` (cópia local do `.env.example`): `KEYCLOAK_PORT`,
  `GATEWAY_PORT`, `GATEWAY_DASHBOARD_PORT`, `POSTGRES_PORT`, `MINIO_PORT` e
  `MINIO_CONSOLE_PORT`, por exemplo `8180`, `15000`, `15080`, `15432`, `19000` e
  `19001`;
- use um nome de projeto próprio (`docker compose -p <projeto> ...`) para não
  disputar containers e volumes com outra stack.

Do lado da web, aponte o app para as portas novas só durante a rodada, no
`apps/<app>/public/assets/runtime-config.json`, e devolva o arquivo ao fim, sem
commit:

```bash
cp apps/configuracao/public/assets/runtime-config.json /tmp/runtime-config.json
sed -i 's#http://localhost:5000#http://localhost:15000#; s#http://localhost:8080/realms#http://localhost:8180/realms#' \
  apps/configuracao/public/assets/runtime-config.json
# ... rodada ...
cp /tmp/runtime-config.json apps/configuracao/public/assets/runtime-config.json
```

As specs reais leem o Keycloak de `KEYCLOAK_URL` (ex.: `http://localhost:8180`).
A API direta continua na `:5200`, que é o padrão de `E2E_API_URL`.

Para derrubar tudo ao fim, inclusive os volumes: `docker compose -p <projeto> ... down -v`.

## 2. Sirva o app

```bash
cd uniplus-web
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

### Validação do acompanhamento (app Seleção)

O `runtime-config.json` do Seleção aceita o booleano opcional
`acompanhamentoValidacaoHabilitada`. Ausente equivale a `false` e preserva menus
e guards atuais; ele não vem ligado em nenhum exemplo ou configuração padrão.

```json
{ "acompanhamentoValidacaoHabilitada": true }
```

Ligado, o menu mostra **Acompanhamento → Painel de processos** e **Cadastro →
Processos seletivos** (este só para `plataforma-admin`). O painel abre para
qualquer usuário autenticado, e `/inscricoes`, `/homologacao`, `/notas` e
`/classificacao` redirecionam para `/dashboard` quem já tem o papel que essas
entradas exigem; sem o papel, o acesso continua negado. A opção não concede autorização
na API: um 403 continua levando a `/acesso-negado`.

Ative somente em ambiente controlado com dados fictícios, nunca em ambiente com
dados reais.

## 3. Faça login

O `ambiente-init` roda o `scripts/setup-keycloak-dev.sh`, que define a senha
**`Uni+Teste26`**, não temporária, para todos os usuários do realm `unifesspa`: os
4 de teste, as personas fictícias e os usuários do OpenLDAP. A fonte é o
`docker/keycloak/README.md` do `uniplus-api` ("Personas fictícias"), e é o mesmo
padrão do `ADMIN_PASS` do roteiro e de `SENHA_DAS_PERSONAS` em
`@uniplus/shared-e2e`.

| Usuário     | Senha         | Papel                                      |
| ----------- | ------------- | ------------------------------------------ |
| `admin`     | `Uni+Teste26` | `plataforma-admin` (painel admin completo) |
| `gestor`    | `Uni+Teste26` | gestor                                     |
| `avaliador` | `Uni+Teste26` | avaliador                                  |
| `candidato` | `Uni+Teste26` | candidato (portal)                         |

A senha `Changeme!123` só vale na importação crua do `realm-export.json`, antes do
setup, e é temporária.

## Sintomas comuns

| Sintoma                                               | Causa                                                              | Correção                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Listas carregam, mas salvar dá erro e volta pro login | APIs não foram iniciadas com o override atual do realm `unifesspa` | Refaça o passo 1 com os dois arquivos compose e a lista de serviços    |
| Catálogos carregam, mas toda escrita responde `401`   | API subida com `docker-compose.smoke.yml`, que valida o realm `unifesspa-dev-local` — leitura de reference data é pública e mascara o problema | `docker inspect docker-uniplus-api-1 ... \| grep -i authority` e recrie a API sem o override de smoke |
| Escrita responde `403` e cai em `/acesso-negado`      | O papel exigido pela rota não está no scope mapping do client no Keycloak, então não chega ao token | Confira `clients/<id>/scope-mappings/realm` na API admin do Keycloak  |
| `404` em `/api/cidades` ou `/api/cep`                 | `geo-api` ou Traefik fora do ar                                    | Confirme ambos os serviços healthy no Compose do passo 1               |
| `404` em `/api/{modulo}/...`                          | Monólito, portal-api ou gateway fora do ar                         | Confirme `uniplus-api`, `portal-api` e `traefik` no Compose do passo 1 |
| `ERR_CONNECTION_REFUSED` em :420x                     | Dev server caiu                                                    | `npx nx serve <app>`                                                   |
| Ninguém consegue conceder perfil na base nova         | `ambiente-init` não rodou ou falhou: não há gestor instalado       | Confira `ps -a ambiente-init` e os logs; repita o `up`                 |
| Spec real falha com "A unidade CEPS não existe"       | A base nova não traz a unidade (uniplus-api#2407)                  | Crie a unidade `CEPS` (passo 1.1) antes das specs                      |
| Anexo nunca sai de "aguardando verificação"           | `verificador` ou `clamd-verificador` fora do ar                    | Suba os dois serviços do passo 1                                       |
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

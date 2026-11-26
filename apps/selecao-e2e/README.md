# E2E da Seleção

## Roteiros da API

Os cenários que usam os roteiros da API exigem o caminho explícito dos arquivos da main da `uniplus-api`:

- `E2E_ROTEIRO_DO_PROCESSO`: caminho para `scripts/roteiro-processo-teste-inscricao.sh`, usado nos cenários de inscrição, projeção e acompanhamento.
- `E2E_ROTEIRO_DAS_NOTAS_DO_ENEM`: caminho para `scripts/roteiro-processo-teste-notas-do-enem.sh`, usado no cenário de notas do ENEM.

`MUNICIPIOS_DE_PROVA` é opcional: contém uma lista JSON de municípios com `codigoIbge` e `uf`, na ordem desejada. As respostas usam o primeiro município; quando vazia ou ausente, a variável usa o padrão do roteiro de inscrição.

## O que a máquina precisa ter

Os roteiros rodam como programas de shell na própria máquina, não dentro do teste. Antes de rodar:

- **Linux com bash 4 ou mais novo.** O roteiro das notas do ENEM usa vetor associativo (`declare -A`), e os dois roteiros leem `/proc/sys/kernel/random/uuid`.
- **`jq` e `curl`.** Se algum faltar, o roteiro para no início com a mensagem "comando ausente".
- **`date` do GNU.** O `date` de macOS e de BSD é recusado, com a mensagem "precisa do GNU date".

Os roteiros não conferem a versão de nenhuma ferramenta. Usam ainda `sed`, `tr`, `grep`, `head`, `tail`, `cat`, `sleep`, `seq` e `mktemp`, que vêm num Linux padrão.

## Ambiente local no ar

Os roteiros chamam serviços reais. Suba o ambiente local do `docker compose` da `uniplus-api`, conforme `docs/setup-ambiente-local.md` daquele repositório, com a API, o Keycloak, o verificador de arquivos e os serviços de infraestrutura, e com o serviço `ambiente-init` concluído, incluídos os dois gestores de acessos que ele instala. O roteiro das notas do ENEM exige também as 60 personas no realm e o serviço de geografia (Geo) local.

O teste autenticado lê a senha do administrador do Keycloak em `KEYCLOAK_ADMIN_PASSWORD`; sem ela, o teste para antes de começar.

## Arquivo de personas

O roteiro das notas do ENEM lê as personas fictícias de `fake-people.json`, do repositório `uniplus-developers` (`src/data/fake-people.json`). Sem configuração, o teste espera o `uniplus-developers` clonado ao lado do `uniplus-web`. Para usar outro arquivo, defina `E2E_FAKE_PEOPLE` com o caminho dele.

## Outros endereços ou portas

O teste e os roteiros leem nomes diferentes, e o teste não repassa o endereço aos roteiros. Para mudar a porta ou o endereço de um serviço, defina os dois nomes:

| Serviço  | Para o teste   | Para os roteiros | Padrão do teste         |
| -------- | -------------- | ---------------- | ----------------------- |
| Keycloak | `KEYCLOAK_URL` | `KC_URL`         | `http://localhost:8080` |
| API      | `E2E_API_URL`  | `API_URL`        | `http://localhost:5200` |
| Geo      | `E2E_GEO_URL`  | `GEO_URL`        | `http://localhost:5400` |

O teste usa sempre o realm `unifesspa`; não mude `KC_REALM` nos roteiros.

## Variáveis opcionais dos roteiros

Os roteiros aceitam outras variáveis com valor padrão; defina-as só com motivo:

- Roteiro de inscrição: `EDITAL_PDF` (PDF do edital enviado), `INICIO_INSCRICAO` e `FIM_INSCRICAO` (período de inscrição).
- Roteiro das notas do ENEM: `RESOLUCAO_PESOS`, `PERSONA_NAO_INSCRITA` e `PERSONA_FORA_DO_ARQUIVO`.
- `SENHA_PERSONAS` (roteiro das notas do ENEM): senha das personas nos roteiros. O teste usa `E2E_SENHA_DAS_PERSONAS` (padrão `Uni+Teste26`) e redefine as senhas das candidatas para esse valor; se você mudar uma das duas, mude a outra para o mesmo valor.

## O que o teste define sozinho

Ao chamar os roteiros, o teste define `ADMIN_USER`, `ADMIN_PASS`, `IDENTIFICADOR_PROCESSO`, `NOME_PROCESSO`, `MODELO_INSCRICAO_ID` (roteiro de inscrição) e `FAKE_PEOPLE` (roteiro das notas do ENEM). Não defina nenhuma delas à mão: o valor que o teste passa prevalece.

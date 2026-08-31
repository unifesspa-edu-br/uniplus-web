# Plano — Passo 5 do editor: cronograma do certame

> Plano de implementação das Stories #480 (cronograma, recursos e convenção de contagem) e #479
> (etapas pontuadas), que o editor apresenta como um passo só. Escrito antes da implementação,
> a partir do domínio da API e do registro canônico do portal — **não** do mock que hoje ocupa
> a posição 5 do wizard.

## Por que o mock não serviu de ponto de partida

O componente `steps/etapas/` existente mostra um `<select>` com três códigos escritos à mão, um
checkbox "permite recurso", uma marca "administrativa" e dois campos de data. Nenhum desses quatro
tem contraparte no contrato:

- os códigos do `<select>` (`INSCRICAO_CANDIDATOS`, `HOMOLOGACAO_INSCRICOES`,
  `DIVULGACAO_RESULTADO_PARCIAL`) não pertencem a nenhum vocabulário da API;
- "permite recurso" não é declaração do operador — é consequência de `produzResultado &&
  !resultadoDefinitivo`, atributos que a fase canônica congela;
- "administrativa" não existe em lugar nenhum do domínio;
- a janela é instante (`date-time`), não data — o mock usa `<input type="date">`.

O mock também funde as duas dimensões que a API separa, o que o CA-01 da #480 proíbe explicitamente.
Vale aqui a mesma lição do Passo 4 (#541): a tela desenhada a partir do que já estava em tela
reproduz um modelo que o domínio não tem.

## As duas dimensões, e por que ocupam um passo só

| Dimensão | Endpoint | O que declara |
|---|---|---|
| Fase do cronograma | `PUT /{id}/cronograma-fases` | `ordem`, `faseCanonicaId`, janela, `atoProduzidoCodigo`, `tiposBancaIds`, `regraRecurso` |
| Etapa pontuada | `PUT /{id}/etapas` | `nome`, `carater`, `tipoEtapaOrigemId`, `peso`, `notaMinima`, `ordem`, `id` |
| Convenção de contagem | `PUT /{id}/algoritmo-contagem-prazo` | `codigo` + `versao` do `rol_de_regras` |

São três gravações independentes, com modelos próprios — nenhuma reaproveita o modelo da outra.
Ficam na mesma tela porque **só a fase `AVALIACAO` agrupa etapas**, por regra do cadastro
(`uniplus.configuracao.fase_canonica.agrupa_etapas_apenas_avaliacao`), e porque as duas se exigem
mutuamente:

- `DefinirCronogramaFases` recusa **na hora** uma fase que agrupa etapas se o processo não tem
  etapa declarada (`ProcessoSeletivo.AvaliacaoSemEtapa`);
- a direção inversa é preguiçosa e só aflora na publicação (`EtapaSemFaseDeAvaliacao`), porque
  uma etapa pode ser declarada depois do cronograma.

Acrescentar a fase de avaliação é, portanto, o que abre o lugar de declarar as etapas. Um passo
separado pediria as etapas fora de qualquer contexto temporal e transformaria a bicondicional em
mensagem de erro dois passos adiante.

A ordem das gravações é **etapas antes do cronograma** — é a única que a API aceita quando há fase
de avaliação.

## O cronograma é livre; o que já foi configurado é que condiciona

O administrador escolhe quantas e quais fases o certame tem. Nenhuma é obrigatória por si. O que
já foi declarado nos passos anteriores é que faz uma fase passar a fazer falta, e cada caso tem
recusa nomeada própria, avaliada na publicação:

| Já declarado | Fase que passa a fazer falta | Recusa |
|---|---|---|
| origem = inscrição própria | alguma com `coletaInscricao` | `ProcessoSeletivo.InscricaoPropriaSemFaseDeColeta` |
| origem = importação externa | **nenhuma** — não há inscrição a coletar | — |
| há distribuição de vagas (`VoBase > 0`) | alguma com `produzResultado` | `ProcessoSeletivo.VagasSemFaseQueProduzResultado` |
| há etapa pontuada | a que tem `agrupaEtapas` | `ProcessoSeletivo.EtapaSemFaseDeAvaliacao` |
| cobra taxa de inscrição | a janela de solicitação de isenção | **não existe ainda** — ver § *Solicitação de isenção* |

A tela apresenta isso como pendência derivada do rascunho, nunca como campo obrigatório fixo: um
processo de importação externa não deve ver "inscrição" cobrada, e um processo sem prova não deve
ver "avaliação" cobrada.

**Recurso não é fase — é atributo de qualquer fase.** `RegraRecursoFase` é 0..1 em cada fase do
cronograma, e a presença da entidade é o que faz a fase admitir recurso: sem enum, sem flag, sem
lista de fases recorríveis em código. A fase `RECURSOS` do catálogo é onde o julgamento acontece,
não "o lugar do recurso".

### Livre, mas com um piso e duas amarras

Três consequências do "livre" que a tela precisa tratar explicitamente, porque nenhuma é óbvia
olhando só o desenho:

**Não existe cronograma vazio depois da primeira gravação.** O validator recusa lista vazia na
borda e o domínio recusa com `CronogramaFasesVazio`. Removida a última fase, não há gravação
possível — o cronograma só muda de conteúdo. A remoção precisa ficar desabilitada na última fase,
dizendo por quê, em vez de oferecer uma ação que sempre volta 422.

**Remover a fase de avaliação não remove as etapas.** `EtapaProcesso` não tem vínculo com fase, e
`DefinirCronogramaFases` não toca a coleção de etapas. Tirada a fase do cronograma, as etapas
continuam no agregado e a publicação passa a recusar com `EtapaSemFaseDeAvaliacao`. A tela aninha
as etapas na fase, o que sugere ao operador o contrário — então ela precisa decidir: ou envia
`PUT /etapas` vazio junto (antes do cronograma, como a ordem já prevê), ou pergunta. Deixar
implícito produz um processo que só falha na publicação.

**Enviar sempre as três dimensões acopla recusas que não têm relação.** Se o operador mudar só uma
data e a tela reenviar tudo, `DefinirEtapas` roda todas as invariantes de etapa — e uma etapa em
estado que `NenhumaEtapaComponeNota` ou `OrdemEtapaDuplicada` recusa passa a bloquear uma edição de
cronograma que nada tem a ver com ela. Enviar só a dimensão suja, mantendo a ordem quando as duas
estiverem, elimina o acoplamento sem mexer no desenho.

## Rastreio

| Fonte | O que estabelece |
|---|---|
| **#480** CA-01 a CA-10 | conceitos separados; catálogos sem códigos locais; coleção integral; recurso tipado; algoritmo explícito sem default; readback; concorrência |
| **#479** CA-01 a CA-10 | catálogo de tipos de etapa; campos do contrato; substituição integral; identidade preservada; lista vazia válida |
| **UNI-REQ-0112** (aprovado) | as três convenções de contagem que o processo escolhe; nenhuma é eleita pelo sistema |
| **UNI-REQ-0113** (aprovado) | prazo de interposição em dias úteis inteiros ou horas; dia corrido e fração recusados |
| **UNI-REQ-0116** (aprovado) | contagem sobre dia útil só publica com calendário vigente **e** algoritmo declarado; nada é aproximado |
| **UNI-REQ-0080** (aprovado) | suspensividade é par valor+unidade, nas três unidades; ausência dos dois desativa a instância |
| **UNI-REQ-0117** (`dependencia_externa`) | publicar processo real que **dependa** de efeito suspensivo aguarda confirmação jurídica |
| **UNI-REQ-0106** (`proposto`) | a janela de solicitação de isenção é período do cronograma, não interposição de recurso |
| **developers#148** CA-02D/F/G/H/I, CA-06 | as regras já decididas da janela de isenção — ver § própria |
| portal, modelo de negócio §2.2/§2.3 | dimensões "Etapas, pesos e desempate" e "Cronograma de fases" |

## Invariantes da API — o que a tela previne e o que ela deixa o servidor arbitrar

Levantadas de `FaseCronograma.cs`, `RegraRecursoFase.cs`, `EtapaProcesso.cs`,
`ProcessoSeletivo.DefinirCronogramaFases` e `DefinirCronogramaFasesCommandHandler`.

### Da fase, provadas pela factory

| Erro | Regra |
|---|---|
| `FaseCronograma.JanelaObrigatoriaEmDataPropria` | `origemData = PROPRIA` exige início **e** fim; `DELEGADA` aceita sem data |
| `FaseCronograma.JanelaInvertida` | fim ≥ início, valendo também em `DELEGADA` |
| `FaseCronograma.AtoProduzidoObrigatorio` | fase que produz resultado declara o código do ato que produz |
| `RegraRecursoFase.FaseNaoProduzResultado` | recurso só onde há resultado |
| `RegraRecursoFase.RecursoContraResultadoDefinitivo` | não cabe recurso contra resultado definitivo |
| `RegraRecursoFase.AncoraDeOutraFase` | o ato recorrido é sempre o ato da própria fase |

`origemData`, `produzResultado`, `resultadoDefinitivo`, `coletaInscricao`, `agrupaEtapas` e
`permiteComplementacao` **não são declarados pelo cliente** — o handler os congela da fase canônica
resolvida (snapshot-copy, ADR-0061). A tela lê esses atributos do catálogo para saber o que pedir,
mas nunca os envia.

### Da regra de recurso

| Erro | Regra |
|---|---|
| `RegraRecursoFase.PrazoNaoPositivo` | prazo de interposição estritamente positivo |
| `RegraRecursoFase.PrazoEmDiasCorridos` | dia corrido recusado na interposição |
| `RegraRecursoFase.PrazoEmFracaoDeDiaUtil` | dias úteis exige inteiro; janela menor que um dia se declara em horas |
| `RegraRecursoFase.SuspensividadeIncompleta` | valor e unidade juntos, ou nenhum dos dois |
| `RegraRecursoFase.SuspensividadeNaoPositiva` | valor positivo quando presente |
| `RegraRecursoFase.RegraCatalogoInvalida` | só `RECURSO-PRAZO-ANCORADO-EM-ATO`, tipo `regra_prazo_recurso` |
| `RegraRecursoFase.PrazoSemUnidadeDeclaravel` | unidade `nenhuma` é ausência disfarçada |
| `RegraRecursoFase.SuspensividadeUnidadeNaoDeclaravel` | idem, no par de suspensividade |

Os enums gerados incluem os valores-zero — `UnidadePrazo.nenhuma` e `CaraterEtapa.nenhum`. Nenhum
`select` pode oferecê-los: o domínio os recusa como ausência disfarçada, e o tipo gerado não os
exclui sozinho.

A suspensividade admite as três unidades — dia corrido inclusive: é outro relógio, e a recusa do
`UNI-REQ-0113` alcança só a interposição. A ausência dos dois campos é a desativação prevista da
instância, não um erro.

### Do cronograma inteiro, provadas pela raiz

| Erro | Regra |
|---|---|
| `ProcessoSeletivo.CronogramaFasesVazio` | ao menos uma fase |
| `ProcessoSeletivo.OrdemFaseDuplicada` | ordem única no cronograma |
| `ProcessoSeletivo.FaseCanonicaDuplicada` | a mesma fase canônica não se repete |
| `ProcessoSeletivo.AvaliacaoSemEtapa` | fase que agrupa etapas exige etapa já declarada |
| `ProcessoSeletivo.PrecedenciaFaseViolada` | para toda aresta com as duas fases presentes, `Ordem(A) < Ordem(B)` |
| `ProcessoSeletivo.SobreposicaoDeJanelasNaoPermitida` | aresta sem sobreposição e ambas com janela: `Fim(A) ≤ Inicio(B)` |
| `FaseCronograma.PermutacaoDeOrdemNaoSuportada` | trocar ordem entre fases retidas formando ciclo fechado |
| `FaseCronograma.ReferenciadaPorExigenciaViva` | remover fase que documento exigido referencia |
| `FaseCronograma.PendenciaReenvioExigeComplementacao` | fase que sobrevive perde `PermiteComplementacao` sendo referenciada por exigência com consequência `PENDENCIA_REENVIO` |
| `IdadeMaximaEmissao.FaseExtremoAusente` | fase que sobrevive perde o extremo usado como âncora de idade máxima **e** o caso global: o cronograma novo deixar de ter qualquer fase com `coletaInscricao` e `fim` definido enquanto houver exigência ancorada em `FIM_INSCRICAO` |

As duas últimas nascem de documentos exigidos (#483, fora de escopo), mas quem editar o cronograma
de um processo que já tem documentos configurados as recebe — e limpar o `fim` de uma fase de
coleta é edição banal. Precisam de mensagem no tratamento de erro, ainda que a dimensão que as
origina não seja desta entrega.

**A ausência de uma das duas fases de uma aresta não é violação** — é o que permite um cronograma
curto. A tela usa as precedências para ordenar e para avisar antes de gravar, mas quem arbitra é o
servidor.

`PermutacaoDeOrdemNaoSuportada` merece tratamento próprio na interface: a recusa orienta a mover
uma fase para uma ordem livre numa chamada separada. Reordenar por arrastar duas fases adjacentes
é exatamente o caso que a produz, então a tela precisa ou renumerar de forma a não fechar ciclo,
ou apresentar a orientação sem perder a edição.

### Da etapa pontuada

| Erro | Regra |
|---|---|
| `EtapaProcesso.NomeObrigatorio` / `NomeTamanho` | nome presente, ≤ 300 caracteres |
| `EtapaProcesso.CaraterObrigatorio` | classificatória, eliminatória ou ambas |
| `EtapaProcesso.PesoInvalido` | peso, quando informado, > 0 |
| `EtapaProcesso.NotaMinimaInvalida` | nota mínima, quando informada, ≥ 0 |
| `EtapaProcesso.OrdemInvalida` | ordem, quando informada, > 0 |
| validator | `peso` e `notaMinima` com no máximo **4 casas decimais** (`numeric(18,4)`) |

E as da coleção, que a raiz e o handler provam — nenhuma delas é de campo isolado:

| Erro | Regra |
|---|---|
| `ProcessoSeletivo.NenhumaEtapaComponeNota` | **havendo etapas**, ao menos uma classificatória ou ambas **com peso** |
| `ProcessoSeletivo.OrdemEtapaDuplicada` | ordem única entre as etapas que a informam |
| `ProcessoSeletivo.IdEtapaDuplicado` | o mesmo `id` não aparece duas vezes no payload |
| `ProcessoSeletivo.EtapaReferenciadaPorDesempate` | remover etapa que um critério `DESEMPATE-MAIOR-NOTA-ETAPA` referencia |
| `ProcessoSeletivo.EtapaReferenciadaPorClassificacao` | remover etapa que uma regra `ELIM-NOTA-MINIMA-ETAPA` referencia |
| `ProcessoSeletivo.TipoEtapaNaoEncontradoOuInativo` | tipo de etapa inexistente ou inativo no cadastro |

`NenhumaEtapaComponeNota` é a que mais surpreende: um processo com **uma única etapa eliminatória
sem peso** — prova de títulos, por exemplo — é recusado, porque `CalcularDivisorMedia()` seria zero
e a fórmula da nota final dividiria por ele. A recusa fala de nota final, não de etapa, então a tela
precisa cobrar o peso onde o operador está olhando. A guarda só vale quando há etapas: lista vazia
continua válida.

`GET /api/configuracao/tipos-etapa` **não tem filtro `ativo`** — aceita só `cursor`, `limit` e
`direction`. O #479 CA-01 pede que item inativo já referenciado continue visível como snapshot sem
voltar a ser opção nova; a separação entre "escolhível" e "exibível" é feita na tela, por
`TipoEtapaDto.ativo`.

`EtapaProcessoInput.id` é opcional e **precisa ser reenviado**, porque
`criteriosDesempate.args.etapaRef` e `regrasEliminacao.args.etapaRef` apontam para ele — e as duas
recusas acima são justamente o que impede perdê-lo em silêncio. (Não é o único id que o envelope
congela: a versão 1.2 passou a congelar também `FaseCronograma.Id`, referenciado por
`documentosExigidos.exigencias[].exigidoNaFaseId` e `referenciaTemporalFatos.faseId`.)

Lista vazia é configuração válida (#479 CA-06) — classificação importada não tem etapa local. A tela
não cria etapa fictícia para satisfazer o wizard.

### Do servidor — não replicar

`CalcularDivisorMedia`, a resolução do ato contra o catálogo de Publicações
(`AtoProduzidoNaoEncontradoNoCatalogo`, `AncoraNaoEncontradaNoCatalogo`, `AncoraEmAtoCongelante`),
a resolução da fase canônica e do tipo de banca, e os gates de publicação. A tela informa; a API
decide.

## A janela é instante, não data

`FaseCronogramaInput.inicio` e `.fim` são `date-time`. O agregado normaliza para UTC preservando o
instante, e o offset com que o cliente escreve é transporte, não domínio (`api#1124` fechou o 500
que o offset não-UTC causava). O `developers#148` CA-02G exige "data e horário completos no fuso
institucional `America/Belem`".

Consequência para a tela: campo de **data e hora**, com o fuso institucional explícito, convertendo
para RFC 3339 no envio. O `<input type="date">` do mock perde a hora, e com ela a diferença entre
"encerra dia 20" e "encerra 20/03 às 23:59:59" — que é justamente o que o mínimo de cinco dias
corridos da isenção mede.

## Solicitação de isenção — decidida no portal, ausente no código

O Passo 3 já grava a cobrança e os fundamentos de isenção, e todo processo que cobra é obrigado a
declarar ao menos um (`UNI-REQ-0099`, `api#1310`). O cronograma correspondente **não tem onde pôr a
janela**: o rol canônico de `FaseCanonicaCatalogo.Codigos` tem quatorze códigos e nenhum é de
solicitação de isenção.

O comportamento já está decidido em `developers#148`:

- **CA-02G** — a janela começa **no mesmo instante do início das inscrições** (início derivado, não
  configurado) e termina **antes** do encerramento das inscrições; só o término é declarado;
- **CA-02H** — duração mínima de **cinco dias corridos**, excluído o dia da abertura, completando-se
  às `23:59:59` em `America/Belem`; a publicação é recusada fora disso;
- **CA-02D/I** — pode ser prorrogada antes do término, nunca reduzida;
- **CA-02F** — não pode ser reaberta depois de encerrada;
- **CA-06/CA-06C** — a fase produz **ato publicado não definitivo** e recebe a **regra geral de
  recurso** já suportada pela API, com janela recursal mínima de dois dias úteis, instância única.

Um processo seletivo à parte só para isenção está descartado por essas mesmas regras: o início da
janela deriva do início das inscrições **do mesmo processo**, e `UNI-REQ-0105` mantém a inscrição
válida após indeferimento. Separar quebraria o CA-02G por construção — e um processo sem vagas nem
publicaria (`DistribuicaoVagasVazia`).

### O que falta, e onde

`api#1232` ("Habilitar recurso na fase de isenção…") e `api#1160` tratam do recurso **dentro** da
fase e a pressupõem existindo. Nenhuma issue a cria. Busca por `SOLICITACAO_ISENCAO` em `src/` e
`tests/` do `uniplus-api` não retorna nada.

Frente de backend a abrir, **antes** do frontend poder oferecer a fase:

1. código novo em `FaseCanonicaCatalogo.Codigos` + migration alterando **três** CHECK constraints,
   não uma — `ck_fase_canonica_codigo_canonico` (em `fase_canonica.codigo`),
   `ck_precedencia_fase_antecessora_canonica` e `ck_precedencia_fase_sucessora_canonica` (em
   `precedencia_fase`), as três com o rol literal de quatorze códigos, criadas em
   `20260701143441_AddFaseCanonicaETipoBanca.cs:39` e
   `20260715223421_AddPrecedenciaFaseEAtributosFaseCanonica`. Esquecer as duas da precedência faz a
   fase nascer inutilizável: ela existiria no cadastro, mas nenhuma aresta poderia referenciá-la.
   Mais a atualização de `uniplus.configuracao.fase_canonica.codigo_fora_do_conjunto_canonico` (a
   página diz "quatorze");
2. as invariantes de janela do CA-02G/CA-02H no agregado — início derivado da fase de coleta,
   término estritamente anterior ao dela, mínimo de cinco dias corridos. **Nenhuma existe hoje:**
   `FaseCronograma` conhece apenas "janela obrigatória em data própria" e "janela não invertida",
   e não tem noção de janela que deriva de outra fase;
3. CA-06C — a fase de isenção só publica com regra de recurso de instância única ≥ dois dias úteis;
4. cadastro do tipo de ato do resultado da isenção (catálogo **aberto**: valida só o formato
   `UPPER_SNAKE`, então é cadastro, não código);
5. precedência de fase entre a isenção e a inscrição, coerente com o CA-02G (sobreposição
   permitida — a janela corre dentro das inscrições);
6. no portal: a contagem de fases onde ela aparece — "quatorze" no `UNI-REQ-0064`, na página de
   erro e no modelo de negócio. (A promoção do `UNI-REQ-0106` já saiu: `developers#217` registrou a
   divergência e `developers#218` a corrige.)

**A premissa deixou de ser frágil.** O registro canônico declarava a decisão pendente e descrevia a
janela como "delimitada por datas" — sem a hora que o mínimo de cinco dias corridos exige. A
divergência foi registrada em `developers#217` e corrigida em `developers#218`: o `UNI-REQ-0106`
passa de `proposto` para aprovado, de decisão para regra de negócio, com os dois extremos em data e
horário completos. O comportamento que esta tela desenha está agora no registro, não só na Story
guarda-chuva.

**A âncora está decidida: é a fase do cronograma, não o par da publicação.** Regra definida pelo PO
e repassada pelo LT em 30/08/2026. O fundamento é o próprio conteúdo da decisão — a janela exige
instante, e `periodoInscricaoInicio` é data sem hora. O par da publicação passa a ser derivado da
fase com `coletaInscricao` ou conferido contra ela, o que torna a reconciliação dos dois períodos
pré-requisito da janela de isenção, e não mais uma inconsistência latente.

Enquanto isso não existe, a fase de isenção é a única coisa do Passo 5 que não pode ser entregue.
Todo o resto independe dela, e quando o código entrar no catálogo ela aparece na tela como mais um
item — **exceto** pelo campo de início não editável, que é comportamento de tela próprio e precisa
ser previsto no desenho desde já.

## Divergência a registrar: dois períodos de inscrição

O período de inscrição existe em dois lugares do contrato, sem invariante conciliando-os:

- `PublicarProcessoSeletivoRequest.periodoInscricaoInicio/Fim` — `DateOnly`, dado do edital,
  informado só na publicação (e de novo em retificar/fechar retificação);
- a fase com `coletaInscricao` do cronograma — `DateTimeOffset`, informada aqui.

Nada impede que o edital publique 01/03–20/03 e a fase `INSCRICAO` declare outro intervalo.

**Qual dos dois é a âncora já está decidido** — a fase do cronograma (ver § anterior). O que falta é
a reconciliação: fazer o par da publicação derivar da fase, ou conferi-lo contra ela na publicação.
Abrir issue. Não bloqueia o Passo 5, mas bloqueia a fase de isenção, cujo início deriva justamente
desse período.

## Dependências

| Recurso | Situação |
|---|---|
| #478 — editor persistente por id | **fechada**; `remoteSnapshot`, `geracao` e `projetarSecao` em uso |
| `rol_de_regras` — `RECURSO-PRAZO-ANCORADO-EM-ATO` | presente, v1 |
| `rol_de_regras` — os três `algoritmo_contagem_prazo` | presentes, v1 |
| `api#1140` — calendário congelado | fechada; `2026.1` vigente |
| Vocabulário de leitura (`api#1294`) | corrigido; host serializa enum em camelCase, com fitness test cruzando tokens |
| `FasesCanonicasApi`, `TiposBancaApi`, `PrecedenciasFaseApi` | **existem** em `shared-data/configuracao` |
| `RegrasCatalogoApi` | existe, com filtro por `tipo` |
| Tipos do contrato no `schema.ts` | **todos presentes**: `FaseCronogramaInput`/`Dto`, `EtapaProcessoInput`/`Dto`, `RegraRecursoFaseInput`, `TipoEtapaSnapshotDto` |
| `TiposEtapaApi` | **ausente** — criar em `shared-data/configuracao` (#479 CA-08) |
| Métodos em `ProcessosSeletivosApi` | **ausentes** — `definirEtapas`, `definirCronogramaFases`, `definirAlgoritmoContagemPrazo` |
| **Módulo `publicacoes` inteiro** | **ausente do frontend** — ver abaixo |
| Fase canônica de isenção | **ausente** — ver § acima |

### O frontend não conhece o módulo Publicações

`atoProduzidoCodigo` e `regraRecurso.atoAncoraCodigo` são resolvidos contra
`GET /api/publicacoes/tipos-ato`. No `uniplus-web` esse módulo simplesmente não existe:

- `libs/shared-data/openapi/` tem `configuracao`, `geo`, `ingresso`, `organizacao` e `selecao` —
  **não tem `publicacoes.openapi.json`**;
- `libs/shared-data/scripts/generate-api-clients.sh:16` declara
  `modules=(selecao ingresso organizacao configuracao geo)`;
- não há `libs/shared-data/src/lib/api/publicacoes/`, e `TipoAtoPublicado` dá **zero ocorrência** em
  todos os `schema.ts` gerados.

O baseline existe do lado da API (`uniplus-api/contracts/openapi.publicacoes.json`) e nunca foi
trazido. Isso não é "escrever mais um client": é sincronizar o baseline, acrescentar `publicacoes`
ao script de codegen, gerar o `schema.ts` do módulo e só então escrever `TiposAtoApi`. Sem esse
trabalho, **nenhuma fase que produz resultado é configurável** — e são elas que carregam recurso.

Some-se que não há tela de `tipos-ato` no app `configuracao` (nem de `tipos-etapa`). A recomendação
de carregar os catálogos pelas telas existentes vale para `fase_canonica`, `precedencia_fase` e
`tipo_banca`; `tipo_ato_publicado` só pode ser carregado pela API direta.

### Catálogos vazios no ambiente local

| Tabela | Registros |
|---|---|
| `configuracao.fase_canonica` | **0** |
| `configuracao.tipo_banca` | **0** |
| `publicacoes.tipo_ato_publicado` | **0** |
| `configuracao.calendario_dias_uteis` | **0** |
| `configuracao.precedencia_fase` | 6 |
| `configuracao.tipos_etapa` | 7 |

O calendário `2026.1` vigente é estado de **HML**, não do ambiente local. Localmente a tabela está
vazia, e qualquer E2E que **publique com sucesso** recusa com
`ProcessoSeletivo.CalendarioVigenteAusente`. A contraprova de publicar sem algoritmo declarado
continua funcionando, porque o gate do algoritmo vem antes do gate do calendário. Há tela:
`apps/configuracao/src/app/features/calendario-dias-uteis/`.

As seis precedências cadastradas têm **todas** `permite_sobreposicao = false`. O teste de "aresta
com sobreposição permitida aceita janelas sobrepostas" não tem dado que o exercite — é preciso
cadastrar uma aresta com sobreposição, e é exatamente a que a fase de isenção vai exigir (a janela
corre dentro das inscrições).

O cadastro de fases é 100% CRUD-administrado, sem seed, por decisão registrada na própria entidade.
Sem `tipo_ato_publicado`, **nenhuma fase que produz resultado é configurável** — o handler recusa
com `AtoProduzidoNaoEncontradoNoCatalogo`. As seis precedências já cadastradas referenciam nove
códigos (`INSCRICAO`, `HOMOLOGACAO`, `RESULTADO_PRELIMINAR`, `RECURSOS`, `RESULTADO_FINAL`,
`HABILITACAO`, `MATRICULA`, `HETEROIDENTIFICACAO`, `HOMOLOGACAO_RESULTADO_FINAL`), o que dá a ordem
esperada do certame.

O app `configuracao` já tem telas de `fases-canonicas`, `precedencias-fase` e `tipos-banca` — não
tem de `tipos-etapa`, mas o Passo 5 só lê esse catálogo. Carregar pelas telas existentes exercita o
fluxo real e vira roteiro reproduzível para HML; é a via preferida, com script de apoio apenas se a
carga precisar ser repetida a cada reset do banco.

### Trabalho vizinho que toca os mesmos arquivos

| Issue | Situação | Interação |
|---|---|---|
| `web#511` | aberta, sem responsável | Gate que bane vocabulário local no wizard; só executa com #480, #481, #482 e #483 na `main`. Divide `DOC_ETAPAS` com #483. |
| `web#483` | aberta, sem responsável | Co-dona de `DOC_ETAPAS`; suas âncoras `INICIO_FASE`/`FIM_FASE` leem a janela das fases criadas aqui. |
| `web#527` | aberta, **com responsável** | Sincroniza o contrato de Seleção — mexe nos mesmos clients gerados. Não tocar; combinar a ordem. |
| `web#507` | aberta, **com responsável** | Anatomia DS e gate AAA em todos os passos do wizard. Não tocar; combinar a ordem. |
| `web#647` | aberta, sem responsável | Converte o passo de vagas para formulário reativo tipado — mesmo padrão que este passo adotará. Vale alinhar antes de divergirem. |
| `web#613`, `web#604` | abertas, sem responsável | Ritmo vertical dos passos e reuso de rota do editor: layout e roteamento compartilhados. |

Duas issues levantadas como possíveis dependências **não** se confirmaram: `api#1134` (prazo em dia
útil, localidade e catálogo de algoritmos) está aberta com as **sete** sub-issues fechadas — o
conteúdo está entregue, a story é que não foi encerrada; e `api#1293` (detalhe devolve tudo para
retomar) tem três lacunas — modalidades, locais de prova e campos de identificação — nenhuma
tocando cronograma, etapas ou algoritmo de contagem, que a própria issue reconhece já presentes no
detalhe.

`web#478` foi fechada com CA-05 a CA-13 ainda desmarcados no corpo. O código mostra hidratação e
readback implementados, mas a issue não os registra como verificados — vale conferir antes de
assumir que algum comportamento da fundação está coberto por teste.

## Modelo do rascunho

A seção é uma só, e as etapas moram dentro dela — não por gosto de aninhamento, mas porque
`projetarSecao` lança em seção que é array (ver § *Hidratação*), e porque é onde o desenho as
coloca.

```ts
cronograma: {
  fases: FaseDoCronograma[];
  etapas: EtapaPontuada[];
  algoritmoContagemCodigo: string;
  algoritmoContagemVersao: string;
};

interface FaseDoCronograma {
  readonly faseCanonicaId: string;
  /** Código congelado — como as demais dimensões nomeiam a fase. */
  readonly codigo: string;
  readonly ordem: number;
  /** RFC 3339 com offset; `null` só é válido em fase de data delegada. */
  readonly inicio: string | null;
  readonly fim: string | null;
  readonly atoProduzidoCodigo: string | null;
  readonly tiposBancaIds: readonly string[];
  readonly regraRecurso: RecursoDaFase | null;
}

interface RecursoDaFase {
  readonly regraCodigo: string;
  readonly regraVersao: string;
  /** Texto, como o campo edita — a conversão acontece no envio. */
  readonly prazoValor: string;
  readonly prazoUnidade: UnidadePrazo;
  readonly atoAncoraCodigo: string;
  readonly suspensividadePrimeiraInstanciaValor: string;
  readonly suspensividadePrimeiraInstanciaUnidade: UnidadePrazo | null;
  readonly suspensividadeSegundaInstanciaValor: string;
  readonly suspensividadeSegundaInstanciaUnidade: UnidadePrazo | null;
}

interface EtapaPontuada {
  /** Devolvido pela API; ausente enquanto a etapa é nova. */
  readonly id: string | null;
  readonly nome: string;
  readonly carater: CaraterEtapa;
  readonly tipoEtapaOrigemId: string;
  readonly peso: string;
  readonly notaMinima: string;
  readonly ordem: number;
}
```

Números como texto pela lição do #624 e do #541: `Number` lê `1.000` como 1. A conversão usa
gramática explícita no envio. O `codigo` acompanha o `faseCanonicaId` pelo mesmo motivo que o código
da modalidade acompanha o id na distribuição de vagas — a precedência e as pendências derivadas
falam em `INSCRICAO`, não em uuid.

## Hidratação

O rascunho guarda os **ids de origem**, que é o que o `PUT` recebe:

- `cronogramaFases[].faseCanonicaOrigemId` → `faseCanonicaId`;
- `cronogramaFases[].bancasRequeridas[].tipoBancaOrigemId` → `tiposBancaIds[]`;
- `etapas[].tipoEtapa.origemId` → `tipoEtapaOrigemId`;
- `etapas[].id` → **preservado** e reenviado.

`FaseCronogramaInput` **não tem campo `id`** — a reconciliação do servidor é por
`FaseCanonicaOrigemId`, que é a identidade estável de uma fase no cronograma. Consequência que vale
registrar: o `FaseCronograma.Id` só sobrevive enquanto aquela fase canônica permanecer no
cronograma; remover e readicionar gera id novo, e é disso que `ReferenciadaPorExigenciaViva`
protege. O `id` da etapa é o oposto — reenviado de propósito, porque desempate e eliminação o
referenciam.

`regraRecurso.regra` volta como `ReferenciaRegraDto` (código, versão, hash); o rascunho guarda
código e versão, nunca o hash, que o handler recompõe do catálogo.

**A projeção não pode passar por `projetarSecao` para seção que é array.** Os dois métodos do store
chamam o mesmo `aplicarPatch`, que **lança** quando a seção é array
(`processo-seletivo.store.ts:330-331`). Foi assim que a distribuição de vagas resolveu: `ofertas` é
array **dentro** do objeto `vagas`, e a projeção acontece em `hidratarDraft`, que reconstrói o draft
inteiro via `draft.update` e por isso já contorna `edicaoPermitida`.

Duas saídas para as etapas, e a segunda casa melhor com o desenho: estender `hidratarDraft`, ou
aninhar as etapas dentro da seção `cronograma` — que é objeto — em vez de deixá-las como seção de
topo. Manter `etapas` como array de topo e projetá-lo por `projetarSecao` produz erro em runtime na
primeira retomada.

## Etapas de implementação

Ordem escolhida para que cada commit feche verde e o passo nunca fique num estado que a API recusa.

1. **Módulo Publicações no frontend** — sincronizar `openapi.publicacoes.json`, acrescentar
   `publicacoes` a `generate-api-clients.sh`, gerar o `schema.ts` e escrever `TiposAtoApi`. Primeiro
   porque sem tipo de ato nenhuma fase que produz resultado grava.
2. **Clientes de Seleção e Configuração** — `TiposEtapaApi`; `definirEtapas`,
   `definirCronogramaFases` e `definirAlgoritmoContagemPrazo` em `ProcessosSeletivosApi`; chaves de
   substituição próprias em `CadastroInicialService`, uma por dimensão.
3. **Modelo, remoção do mock e hidratação, no mesmo commit** — a seção `cronograma` entra, a seção
   `etapas: EtapaEdital[]` sai, e o componente `steps/etapas/` sai junto. Os três são um commit só
   por necessidade: `steps/etapas/etapas.component.ts` é o **único** consumidor de `EtapaEdital`
   (fora de `models.ts` e do store) e chama `patchSection('etapas', …)`; trocar o tipo do rascunho
   deixando o mock para depois quebra `nx build selecao` no intervalo. No mesmo commit,
   `INITIAL_DRAFT` deixa de semear `[initialEtapa()]` — hoje todo processo novo nasce com uma etapa
   vazia, o oposto do #479 CA-06.
4. **Catálogos na tela** — serviço análogo a `CatalogosDeDistribuicaoService`, carregando por cursor
   até o fim: fases canônicas, precedências, tipos de banca, tipos de etapa, tipos de ato e as
   regras dos dois tipos (`regra_prazo_recurso`, `algoritmo_contagem_prazo`). Ou vêm todos, ou
   nenhum — um catálogo faltando faz a tela oferecer menos do que existe.
5. **Linha do tempo com as etapas na fase que as agrupa** — acrescentar, remover e reordenar fases;
   a fase escolhida exibe seus atributos congelados e pede só o que eles exigem (janela conforme
   `origemData`, ato conforme `produzResultado`); a fase com `agrupaEtapas` expande e recebe as
   etapas. Gravação: `PUT /etapas` **antes** de `PUT /cronograma-fases`.

   **As duas metades não se separam em commits.** Uma linha do tempo entregue sem as etapas deixa o
   operador escolher a fase que agrupa etapas e receber `ProcessoSeletivo.AvaliacaoSemEtapa` na
   hora, sem ter onde declarar a etapa que resolveria — exatamente o estado que a ordem das etapas
   existe para evitar. Ou vão juntas, ou a primeira esconde a fase agrupadora do seletor.

   Ainda aqui: ordenação sugerida pelas precedências, aviso de violação antes de gravar e
   tratamento próprio da permutação cíclica.
6. **Recurso por fase** — oferecido só onde `produzResultado && !resultadoDefinitivo`; ato âncora
   fixado no ato da própria fase; unidades conforme `UNI-REQ-0113`; suspensividade como par
   completo ou ausente.
7. **Convenção de contagem** — seleção sem pré-seleção, exibindo descrição e base legal que a API
   devolve; exigida assim que qualquer fase tem recurso (`UNI-REQ-0116`).

   O endpoint **não aceita limpar a declaração**: código ou versão nulos devolvem 422
   (`ProcessoSeletivo.AlgoritmoContagemPrazoNaoDeclarado`), embora o contrato tipe os dois como
   `null | string` e convide a modelar "desmarcar". Consequências: não disparar o `PUT` enquanto
   não houver escolha, e não oferecer opção "nenhuma" depois de escolhida.
8. **Pendências derivadas** — o painel que cruza o rascunho com o cronograma e diz o que falta, com
   a fase de isenção entrando quando o backend a entregar.

**`DOC_ETAPAS` não sai em nenhuma dessas etapas** — ver § abaixo.

### `DOC_ETAPAS` não é remoção deste passo

O CA-02 da #480 diz "sem `DOC_ETAPAS` ou códigos locais", mas quem consome a constante é o **passo
de documentos**, não o de cronograma: `steps/documentos/documentos.component.ts:2,17` e
`steps/processo-seletivo.store.ts:4,21` (que a usa para semear `DocumentoConfig.etapas`). Removê-la
dentro desta entrega quebraria o passo de documentos.

A `web#511` — o fitness test que bane vocabulário institucional local no wizard — atribui
`DOC_ETAPAS` a **"#480 e #483"**, trabalho compartilhado, e declara que a execução dela só fica
desbloqueada com #480, #481, #482 e #483 integradas à `main`. O que cabe a este passo é **produzir
a fonte** que substituirá a constante: as fases do cronograma, com id e código reais. A troca do
consumo acontece em #483, que precisa da janela da fase para as âncoras `INICIO_FASE`/`FIM_FASE` da
idade máxima de emissão.

## Testes

Um por invariante das tabelas acima, mais:

- fase `DELEGADA` grava sem janela; fase `PROPRIA` sem janela é recusada;
- fim igual ao início é aceito (fase de um dia);
- janela enviada com offset de `America/Belem` sobrevive ao round-trip sem deslocar o instante;
- precedência com as duas fases presentes recusa a ordem invertida; **com só uma presente, aceita**;
- aresta sem sobreposição recusa janelas sobrepostas; com sobreposição permitida, aceita;
- permutação cíclica de ordem entre duas fases retidas produz orientação sem perder a edição;
- fase que agrupa etapas sem etapa declarada é recusada, e a tela diz o que falta;
- etapa preserva `id` ao editar e ao reordenar; detalhe → rascunho → input mantém o id;
- lista de etapas vazia grava e reabre como "sem etapas pontuadas", sem default local, **e um
  processo recém-criado nasce sem etapa alguma**;
- uma única etapa eliminatória sem peso é recusada, e a tela cobra o peso na etapa, não na fórmula;
- duas etapas com a mesma ordem são recusadas; reordenar renumera sem colidir;
- remover etapa referenciada por desempate ou por regra de eliminação é recusado, com aviso antes;
- tipo de etapa inativo não é oferecido como opção nova, mas continua visível quando já referenciado;
- peso e nota mínima com mais de quatro casas decimais são recusados;
- retomar um processo com etapas gravadas projeta o rascunho **sem lançar** — a regressão do
  `projetarSecao` em seção que é array;
- remover a última fase do cronograma não é oferecido;
- remover a fase que agrupa etapas resolve as etapas de forma explícita, sem deixar o processo
  impublicável em silêncio;
- editar só a data de uma fase não dispara recusa vinda da dimensão de etapas;
- prazo em dias corridos, em fração de dia útil e não positivo são recusados, cada um com sua
  mensagem;
- suspensividade com uma metade só é recusada; com nenhuma, aceita e significa "não bloqueia";
- recurso em fase de resultado definitivo não é oferecido;
- nenhuma convenção de contagem aparece pré-selecionada; configurar recurso passa a exigi-la;
- falha de uma das três gravações não zera as outras duas dimensões (#480 CA-08);
- gravação de cronograma não parte de um estado em que as etapas ainda não foram gravadas.

Os E2E com API real cobrem, no mínimo: cronograma de uma fase sem recurso, cronograma com avaliação
e duas etapas reordenadas, e a contraprova de publicar sem algoritmo declarado.

## Riscos

- **Módulo Publicações ausente do frontend.** É o item de maior risco de estimativa: o plano
  original o tratava como "mais um catálogo a carregar", e é uma etapa de contrato inteira — baseline,
  codegen, schema, client. Nada da dimensão de recurso funciona antes dela.
- **Catálogos vazios.** Bloqueio operacional imediato: sem `fase_canonica`, `tipo_banca`,
  `tipo_ato_publicado` e `calendario_dias_uteis`, a tela não tem o que oferecer, nenhuma fase que
  produz resultado grava, e a publicação recusa. Carregar antes de começar a implementação.
- **Tamanho.** Comparável ao Passo 4. Mitigado com commits por etapa, cada um verde.
- **Ordem das gravações.** Três dimensões numa tela, com dependência entre duas. Uma falha em
  etapas precisa impedir o envio do cronograma sem apagar o que o operador digitou.
- **Fase de isenção fora do alcance do frontend.** Depende de trabalho de backend que ainda não tem
  issue. Prever o campo de início derivado no desenho evita redesenho depois.
- **Efeito suspensivo.** `UNI-REQ-0117` está em `dependencia_externa`: configurar é possível, mas
  publicar processo **real** que dependa dele aguarda decisão jurídica. Não bloqueia a tela;
  bloqueia o certame que a usar dessa forma.
- **Rollback:** reverter os commits; nenhuma migração de frontend, nenhum contrato muda.

## Fora de escopo

Critérios de desempate, fórmula, eliminação e bônus (#482) — o portal os agrupa em outras
dimensões (§2.2 e §2.6), e absorvê-los aqui ampliaria o passo além das duas Stories. Quando #482
for feita, o passo de desempate é candidato natural a se juntar ao de etapas, como o portal os
descreve.

Documentos exigidos por fase (#483) e referência temporal de fatos — consomem `FaseCronograma.Id`,
mas são dimensão própria com endpoint próprio.

Interposição, julgamento e efeito suspensivo em runtime (`api#58`, `api#1232`, `api#1233`): aqui só
se **configura** o que aquele mecanismo lerá depois.

## Limitação conhecida do modelo

A mesma fase canônica não se repete no cronograma (`FaseCanonicaDuplicada`), então há no máximo uma
`AVALIACAO`. Um certame com duas avaliações em datas distintas — prova objetiva num dia, entrevista
em outro — não é representável hoje: as etapas dentro da fase não têm janela própria. Registrar como
questão de modelagem se o caso aparecer num edital real; não bloqueia esta entrega.

## Roteiro de execução autônoma

Escrito para ser seguido sem supervisão, numa sessão longa. A ordem não é sugestão: cada passo
depende do anterior por uma razão nomeada, e pular um deixa o seguinte num estado que a API recusa
ou que não compila.

### Passo 0 — massa de dados no ambiente local

Antes de qualquer código, porque sem isso nenhuma task se testa contra o backend. Os cadastros
abaixo estão **vazios** no Postgres local, e o cronograma consome todos.

| Cadastro | O que criar | Via |
|---|---|---|
| `configuracao.fase_canonica` | as 14 do vocabulário | tela do app `configuracao` ou API admin |
| `configuracao.tipo_banca` | os 4 tipos | tela do app `configuracao` ou API admin |
| `publicacoes.tipo_ato_publicado` | os atos que as fases produzem, mais o de abertura do edital | **só API** — não há tela |
| `configuracao.calendario_dias_uteis` | o dataset vigente | tela do app `configuracao` |
| `configuracao.precedencia_fase` | uma aresta **com** sobreposição | API admin |

Três regras do cadastro amarram os atributos, e violá-las é recusa nomeada: `agrupa_etapas` só é
verdadeiro em `AVALIACAO`; `resultado_definitivo` verdadeiro pressupõe `produz_resultado`
verdadeiro; `origem_data` própria obriga janela na fase que a usa. O resto — dono típico, base
legal, quais fases permitem complementação além das que a lei já fixa — é escolha institucional.

**Isto é massa de teste, não cadastro institucional.** O que entrar aqui existe para exercitar a
tela e os E2E locais; a carga de homologação é decisão do CEPS e não sai deste roteiro. Registrar
os comandos usados num script versionado do workspace, para que o ambiente seja reproduzível depois
de um reset do banco.

Critério de conclusão do passo: uma gravação de cronograma com uma fase que produz resultado é
aceita pela API local.

### Ordem das tasks

```
#655  contrato do módulo Publicações          ── nada depende de nada; destrava as demais
  │
  ├── #653  tipos de etapa + gravação de etapas
  ├── #656  gravação de cronograma + convenção
  │
  └── #654  modelo do rascunho, remoção do mock, hidratação
        │
        └── #657  linha do tempo com as etapas na fase que as agrupa   ← a maior
              │
              ├── #658  recurso por fase + convenção de contagem
              └── #659  pendências derivadas
```

`#655` primeiro e sozinha: sem tipo de ato, nenhuma fase que produz resultado grava, e são elas que
carregam recurso. `#653` e `#656` são independentes entre si. `#654` precisa vir antes de `#657`
porque troca o tipo do rascunho e remove o mock — e as duas metades de `#657` (linha do tempo e
etapas) não se separam, pela bicondicional.

### Ciclo por task

O mesmo para todas, sem atalho:

1. **Branch** a partir da `main` atualizada — `feature/{issue}-{slug}`.
2. **Implementar** a task inteira, consultando as seções deste plano que ela cita.
3. **Gates locais antes do PR**, todos verdes: `nx lint`, `nx typecheck`, `nx vite:test`,
   `nx build <projeto> --configuration=production` e, quando o contrato mudar, `codegen-api-check`.
   O build de produção é o único que pega import relativo entre entry points.
4. **Commit** em conventional commits pt-BR, indicativo presente na 3ª pessoa, descrevendo a
   mudança no código — nunca o processo de revisão. Sem atribuição de IA.
5. **PR** vinculando a issue com `Closes #N` no corpo, com notas ao revisor antecipando o que for
   previsivelmente questionável.
6. **Revisão dupla**, e é aqui que entra o apoio externo:
   - o **Codex** revisa no PR automaticamente ao abrir;
   - em paralelo, um **subagente em contexto limpo** revisa o diff — sem ver o raciocínio que o
     produziu, com instrução de reportar só o que tem cenário de falha concreto. Zero achados é
     resultado válido.
7. **Aplicar os achados confirmados.** Achado que cita documento ou requisito é conferido na fonte
   antes de virar mudança — rótulo não é estado, e a revisão deste plano já produziu dois achados
   que não se sustentaram. "Não bloqueante" não significa "não corrigir".
8. **Responder e resolver cada thread**, inclusive as que não geraram mudança, dizendo por quê.
9. **CI verde** — todos os checks, sem exceção.
10. **Aprovar** com a conta de review e **mergear com rebase**, mantendo o histórico linear.
11. **Voltar para a `main`**, atualizar, e só então começar a próxima.

Nenhuma task começa com a anterior sem merge. O objetivo é que a `main` esteja sempre em estado
publicável, e que uma falha numa task não contamine a seguinte.

### Testes ao longo do caminho

**Por task:** os testes que a própria task lista, mais um por invariante que ela toca. A regra que
vale mais do que a contagem: o teste precisa **falhar sem o fix**. Um teste que passa antes e depois
não prova nada.

**E2E contra backend real:** a suíte tem projeto próprio, atrás de `E2E_BACKEND_REAL=1`, e exige a
stack local de pé. Rodar ao fechar `#657` — antes disso não há tela que o exercite — e de novo ao
fechar `#659`. Cobertura mínima: cronograma de uma fase sem recurso; cronograma com a fase de
avaliação e duas etapas reordenadas, provando que os ids sobrevivem; e a contraprova de publicar sem
convenção declarada quando há fase com recurso.

**Ao final:** a suíte inteira do `selecao` e do `selecao-e2e`, mais a matriz responsiva e o axe.

### Onde parar e perguntar

Autonomia não é decidir tudo. Parar e registrar, sem inventar saída:

- **regra de negócio que o registro canônico não cobre** — o portal é a fonte, e requisito
  desatualizado vira issue própria, não bloqueio;
- **mudança de contrato da API** — remover ou renomear campo é quebra sujeita à ADR-0028;
- **decisão que muda o desenho** deste plano — ele foi acordado, e alterá-lo sozinho no meio da
  execução desperdiça a revisão que o validou;
- **issue atribuída a outra pessoa** — nunca tocar;
- **qualquer coisa que exija cadastro institucional real**, distinto da massa de teste.

Nesses casos: registrar no plano ou em issue, seguir com o que não depende da resposta, e deixar
explícito o que ficou pendente.

### Registro de progresso

Manter, ao longo da sessão, o estado de cada task — o que foi feito, o que falhou, o que ficou
pendente — de modo que o relatório final diga onde cada uma parou, e não só quantas fecharam. Task
que não fecha não vira silêncio: vira linha do relatório, com a razão.

## Decisões incorporadas

| Decisão | Origem |
|---|---|
| Cronograma livre; o já configurado é que condiciona quais fases fazem falta | Tech Lead, nesta sessão |
| Etapas pontuadas dentro da fase que as agrupa, na mesma tela | Tech Lead, nesta sessão |
| Fase de solicitação de isenção entra — não fica de fora | Tech Lead, nesta sessão |
| A fase de isenção produz ato publicado não definitivo e admite recurso | Tech Lead, nesta sessão, coerente com `developers#148` CA-06 |
| Janela de isenção dentro das inscrições, início derivado, término declarado | `developers#148` CA-02G/CA-02H, promovido ao registro canônico em `developers#218` |
| Processo seletivo à parte só para isenção: descartado | `developers#148` CA-02G; `UNI-REQ-0105` |
| A âncora da janela é a fase com `coletaInscricao`, não o par da publicação | PO, repassado pelo LT em 30/08/2026 |

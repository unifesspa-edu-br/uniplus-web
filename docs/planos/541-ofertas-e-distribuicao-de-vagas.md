# Plano — uniplus-web#541: ofertas e distribuição de vagas no editor

> Plano de implementação da Story #481, fatia de ofertas e distribuição. Escrito antes da
> implementação e revisado duas vezes; as correções da revisão estão incorporadas e assinaladas.

## Decisão de corte

Fatia única. O corte inicial previa separar "listar ofertas" de "escolher regra", e não se sustenta:
a regra de distribuição escolhida determina se a referência demográfica é exigida, se o par de
ajuste é obrigatório, quais modalidades precisam estar selecionadas e **quais delas aceitam
quantidade fixada**. Separar produziria uma tela que valida pela metade.

## Rastreio

| Fonte | O que estabelece |
|---|---|
| **UNI-REQ-0134** (aprovado, must) | `VO_base` positivo, `PR` entre 0,5 e 1,0 (art. 10, II), ao menos uma modalidade, sem repetir modalidade na oferta, oferta resolvida contra o catálogo vivo, ao menos uma distribuição no processo, cada oferta em no máximo uma distribuição |
| **UNI-REQ-0137** (aprovado) | Oferta declara regime e turnos: `REGULAR` = um turno, `INTEGRAL` = dois distintos. Não existe turno chamado INTEGRAL. O regime é lido do campo próprio, **nunca inferido**. Turnos em ordem canônica estável |
| **UNI-REQ-0010** | Curso e OfertaCurso como entidades de Configuração |
| **#481** CA-01 a CA-08 | oferta canônica; distribuição completa; referências válidas; full replace por dimensão com save independente; readback; API árbitra dos cálculos |
| **#541** | o editor **exibe** regime e turnos e não permite editar |

## Invariantes da API

Levantadas de `SelecaoDomainErrorRegistration.cs` e `ConfiguracaoDistribuicaoVagas.cs` no
`uniplus-api`.

### Sempre

| Erro | Regra |
|---|---|
| `VoBaseInvalido` | VO_base > 0 |
| `PrForaDoLimite` | 0,5 ≤ PR ≤ 1,0 |
| `ModalidadesVazias` | ao menos uma modalidade por oferta |
| `ModalidadeDuplicada` | modalidade não se repete na oferta |
| `QuantidadeVagaNegativa` | quantidade não negativa |
| `QuadroModalidadeNaoSelecionada` | todo item do quadro é modalidade selecionada |
| `ProcessoSeletivo.DistribuicaoVagasVazia` | ao menos uma distribuição no processo |
| validator | `Pr` com no máximo 4 casas decimais |
| UNI-REQ-0134 | cada oferta em no máximo uma distribuição do processo |

### Fronteira da quantidade — condicional à regra

Corrigido na segunda revisão. A primeira versão do plano dizia que toda modalidade selecionada exige
quantidade, o que quebraria a Lei 12.711 inteira.

**Fora de `DISTRIB-VAGAS-LEI-12711`:** toda modalidade selecionada exige quantidade
(`QuadroModalidadeAusente`).

**Na Lei 12.711**, depende de `composicaoVagas` da modalidade:

| Composição | Quantidade |
|---|---|
| `DENTRO_DO_VR`, `RESIDUAL_DO_VO` | **calculada** — informar é erro (`QuantidadeCalculadaNaoInformavel`) |
| `RETIRA_DE`, `SUPLEMENTAR_AO_TOTAL` | **obrigatória** (`QuantidadeDeclaradaObrigatoria`) |

`ModalidadeDto` expõe `composicaoVagas`, então a tela sabe qual caso aplicar sem adivinhar.

### Condicionais à regra Lei 12.711

| Erro | Regra |
|---|---|
| `ReferenciaDemograficaObrigatoria` | exigida no ramo federal |
| `ReferenciaDemograficaIndevida` | proibida fora dele |
| `RegraAjusteObrigatoria` | art. 11, § único |
| `ModalidadesFederaisIncompletas` | as 8 federais mais AC |

### Relacionais entre modalidades

Acrescentadas na segunda revisão. `ModalidadeDto` traz os campos que as tornam verificáveis na tela:

| Erro | Campo da modalidade |
|---|---|
| `ComposicaoOrigemNaoSelecionada` | `composicaoOrigem` (quando `RETIRA_DE`) |
| `RemanejamentoDestinoNaoSelecionado` | `remanejamentoDestino` (quando `DESTINO_UNICO`) |
| `RemanejamentoParNaoSelecionado` | `remanejamentoPar` (quando `CRUZADO`) |
| `RemanejamentoFallbackNaoSelecionado` | `remanejamentoFallback` (quando `CRUZADO`) |

### Do servidor — não replicar

`QuadroAmplaConcorrenciaNegativa`, `QuadroChaveColide`, `vrNominal`, `vrFinal`, `estouro`,
`capadoEmVo`, `totalPublicado`.

É para isso que existe `POST /distribuicao-vagas/simulacao`: a API é árbitra (#481 CA-08).
Reimplementar a Lei de Cotas em TypeScript seria a divergência mais provável desta tela.

### De resolução — o servidor decide

`OfertaCursoNaoEncontrada`, `RegraDistribuicaoNaoEncontrada`, `RegraDistribuicaoTipoInvalido`,
`ReferenciaDemograficaNaoEncontrada`, `ModalidadeNaoEncontrada`.

## Dependências — todas já existem

| Catálogo | Cliente |
|---|---|
| Ofertas de curso | `OfertasCursoApi` (Configuração) |
| Modalidades | `ModalidadesApi` (Configuração) |
| Referência demográfica | `ReservaDemograficaApi` (Configuração) |
| Regras versionadas | `RegrasCatalogoApi` — #631, filtrando por tipo |

## Modelo do rascunho

```ts
vagas: { ofertas: DistribuicaoDeVagas[] };

interface DistribuicaoDeVagas {
  readonly ofertaCursoId: string;
  readonly voBase: string;
  readonly pr: string;
  readonly regraDistribuicaoCodigo: string;
  readonly regraDistribuicaoVersao: string;
  readonly regraAjusteCodigo: string | null;
  readonly regraAjusteVersao: string | null;
  readonly referenciaReservaDemograficaId: string | null;
  readonly modalidadeIds: readonly string[];
  readonly quadro: readonly { readonly modalidadeId: string; readonly quantidade: string }[];
}
```

Números como texto pela lição do #624: `Number` lê `1.000` como 1. A conversão usa gramática
explícita no envio.

## Hidratação

O rascunho guarda sempre os **ids de origem**, porque é o que o `PUT` recebe:

- `ofertaCursoOrigemId`
- `modalidades[].modalidadeOrigemId`
- `quadro[].modalidadeOrigemId`
- `referenciaDemografica.origemId` — acrescentado na segunda revisão; o `id` da distribuição não
  serve para `referenciaReservaDemograficaId`

Usar o `id` do snapshot geraria referência órfã no envio seguinte.

A projeção passa por `projetarSecao`, não `patchObjectSection`: o bloqueio de edição fora de
rascunho não pode derrubar a releitura (lição do #625).

## Etapas

1. **Modelo e hidratação** — `DistribuicaoDeVagas` no rascunho; projeção do detalhe com ids de origem.
2. **Catálogos na tela** — ofertas com regime e turnos exibidos sem edição; modalidades com sua
   composição; referência demográfica; regras filtradas por tipo.
3. **Validação** — invariantes das tabelas acima, com as condicionais ligadas à regra escolhida.
4. **Simulação** — `POST` exibe os calculados; o resultado é invalidado a cada edição do payload.
5. **Gravação** — `PUT` full replace do array, com `Idempotency-Key` e rotação por `proximaChave`.
6. **Remoção** — `CURSOS` e o tipo `Curso` saem de `processo-seletivo.data.ts`; confirmado por grep
   que só o passo de Vagas os usa.

A ordem entre 4 e 5 foi corrigida na segunda revisão: simular antes de gravar, e não o contrário.

## Testes

Um por invariante, mais:

- oferta `INTEGRAL` mostra os dois turnos **em ordem estável**, e nenhum rótulo "Integral" como turno;
- oferta `REGULAR` mostra o turno único, e o regime vem de `regimeDeTurno`, não de
  `programaDeOferta` nem de inferência pela quantidade;
- turno não editável;
- trocar para a Lei 12.711 passa a exigir referência demográfica, ajuste e as 8 federais;
- trocar para outra regra recusa referência demográfica preenchida;
- **troca de regra nos dois sentidos** reprojeta o quadro conforme a fronteira da quantidade;
- modalidade `RETIRA_DE` sem a origem selecionada é recusada, e o mesmo para destino, par e fallback;
- mesma oferta em duas distribuições é recusada;
- detalhe → rascunho → input preserva os ids de origem, inclusive o da referência demográfica;
- recusa da API identifica a oferta e o campo, sem apagar o formulário (#481 CA-08);
- gravação não parte de payload cuja simulação não passou.

## Riscos

- **Tamanho.** É a maior tela do editor. Mitigado com commits por etapa, cada um verde.
- **Cálculo do quadro.** Não replicar; a simulação é a fonte.
- **Catálogos grandes.** Paginação por cursor nos quatro (a #580 registra truncamento por limite
  fixo em Configuração).
- **Rollback:** reverter o commit; nenhuma migração ou contrato muda.

## Fora de escopo

Cascata de remanejamento (#542) e atendimento especializado (#543) — dimensões próprias, com
endpoint e save independentes (#481 CA-06).

## O que mudou durante a implementação

O plano previa a tela; o teste contra o backend local mostrou o que ele não tinha como antecipar.

**O passo de Modalidades saiu do wizard.** As modalidades passaram a ser escolhidas onde as vagas
são distribuídas, que é onde elas significam alguma coisa. Manter os dois lugares obrigaria o
operador a decidir duas vezes o mesmo conjunto e a mantê-los coerentes na mão. O que dependia
daquele passo — concorrência dupla e documentos por modalidade — passou a ler o rascunho de vagas.

**Duas recusas que o plano não listava, ambas ausentes também no agregado:**

- o total de vagas de uma oferta não pode passar do que o ato de autorização lhe concede
  (`vagasAnuaisAutorizadas`) — a API aceita `voBase: 99999` numa oferta autorizada para 40
  (`uniplus-api#1311`), e o requisito não registra a regra (`uniplus-developers#202`);
- a soma das quantidades fixadas não pode passar do total da oferta — a API devolve
  `totalPublicado: 42` para `voBase: 40` (`uniplus-api#1312`). A composição `SUPLEMENTAR_AO_TOTAL`
  fica fora da soma: ela acresce vagas ao total em vez de disputá-las.

**O vocabulário dos enums diverge entre as duas rotas.** O catálogo de Configuração publica
`RETIRA_DE`; o detalhe de Seleção emite `RetiraDe` (`uniplus-api#1294`). A tela cruza as duas
fontes para saber o que é declarado e o que é calculado, então a grafia é decodificada na
fronteira. Sem isso a quantidade declarada de `AC_PCD` sumia ao reabrir o processo.

**Ajustes de uso vindos do teste com 20 cursos:** marcação em bloco das modalidades, com atalho
para as nove que a Lei 12.711 exige; aviso de reserva acima do percentual declarado retraído por
padrão; confirmação antes de remover uma oferta do quadro, que leva junto a distribuição da linha.

## Histórico de revisão

| Rodada | Achados incorporados |
|---|---|
| 1ª | rascunho não guardava as regras nem a referência demográfica; hidratação por ids de origem; `DistribuicaoVagasVazia`; bijeção quadro↔modalidades; ordem canônica dos turnos |
| 2ª | fronteira da quantidade é condicional à regra (P1 — a versão anterior quebraria a Lei 12.711); origem da referência demográfica na hidratação (P1); guarda de oferta única; ordem simulação→gravação; invariantes relacionais de modalidades; teste de `REGULAR` e do campo `regimeDeTurno` |
| implementação | passo de Modalidades eliminado; teto de vagas autorizadas e soma do quadro (duas recusas ausentes no agregado); decode do vocabulário PascalCase do detalhe; marcação em bloco, aviso retrátil e confirmação de remoção |

import {
  DefinirCascataRemanejamentoRequest,
  DestinoRemanejamentoInput,
  RegraRemanejamentoModalidadeCodigo,
} from '@uniplus/shared-data/selecao';

import type {
  MatrizDaOrdemDeRemanejamento,
  OrdemDeOrigem,
} from '../../documento/edicoes/ordem-de-remanejamento.edicao';
import { CascataSelecionada, DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ehRamoFederal } from './composicao-de-vagas';
import {
  ModalidadeDoCatalogo,
  rotuloDaModalidade,
  rotulosPorCodigo,
} from './modalidades-da-distribuicao';

type Rotulo = (codigo: string) => string;

function rotuladorDe(catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>): Rotulo {
  const rotulos = rotulosPorCodigo(catalogo);
  return (codigo) => rotuloDaModalidade(rotulos, codigo);
}

/**
 * Lê o `declaracaoDaRegra` da regra de remanejamento — shape `{"destinoFinalCodigo":
 * "AC", "ordens": [{"origem": "...", "destinos": ["...", ...]}]}` — devolvendo
 * `null` quando não bate com o esperado.
 *
 * `declaracaoDaRegra` chega como `unknown` (é `JsonElement` no contrato): a tela não
 * confia na forma sem checar, porque um catálogo com outra regra do mesmo tipo
 * poderia declarar um esquema diferente no futuro. `null` aqui vira "regra sem
 * matriz reconhecida" na tela, nunca uma matriz inventada.
 */
export function matrizDaRegra(declaracaoDaRegra: unknown): MatrizDaOrdemDeRemanejamento | null {
  if (typeof declaracaoDaRegra !== 'object' || declaracaoDaRegra === null) return null;

  const bruto = declaracaoDaRegra as Record<string, unknown>;
  const destinoFinalCodigo = bruto['destinoFinalCodigo'];
  const ordensBrutas = bruto['ordens'];
  if (typeof destinoFinalCodigo !== 'string' || !Array.isArray(ordensBrutas)) return null;

  const ordens = ordensBrutas.map(ordemDaMatriz);
  if (ordens.some((ordem) => ordem === null)) return null;
  return { fallbackCodigo: destinoFinalCodigo, ordens: ordens as OrdemDeOrigem[] };
}

function ordemDaMatriz(itemBruto: unknown): OrdemDeOrigem | null {
  if (typeof itemBruto !== 'object' || itemBruto === null) return null;
  const item = itemBruto as Record<string, unknown>;
  const origem = item['origem'];
  const destinosBrutos = item['destinos'];
  if (typeof origem !== 'string' || !Array.isArray(destinosBrutos)) return null;
  if (!destinosBrutos.every((destino): destino is string => typeof destino === 'string')) {
    return null;
  }
  return { origem, destinos: destinosBrutos };
}

/** A modalidade segue a cascata única do processo — vocabulário fechado do catálogo. */
function segueCascata(
  modalidadeId: string,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): boolean {
  return (
    catalogo.get(modalidadeId)?.regraRemanejamento ===
    RegraRemanejamentoModalidadeCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO
  );
}

/** A oferta tem ao menos uma modalidade selecionada que segue a cascata única do processo (UNI-REQ-0056). */
export function ofertaExigeCascata(
  oferta: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): boolean {
  return oferta.modalidades.some((modalidade) => segueCascata(modalidade.id, catalogo));
}

/** A oferta não usa o ramo federal (Lei 12.711, em qualquer variação) — espelha `OfertaForaDoRegimeFederal` do domínio. */
export function ofertaForaDoRegimeFederal(oferta: DistribuicaoDeVagas): boolean {
  return !ehRamoFederal(oferta.ramoDaDistribuicao);
}

/**
 * A seção da cascata só aparece quando há ao menos uma oferta que a exige **e**
 * usa o ramo federal — espelha `PendenciaDaCascata`/`ExisteCascataForaDoRegimeFederal`
 * do agregado (`ProcessoSeletivo.cs`). Revelar a seção fora disso pediria ao
 * operador uma declaração que não fecha pendência nenhuma.
 */
export function precisaExibirSecaoDaCascata(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): boolean {
  return ofertas.some(
    (oferta) => ofertaExigeCascata(oferta, catalogo) && !ofertaForaDoRegimeFederal(oferta),
  );
}

/**
 * Ofertas que exigem a cascata mas usam regra de distribuição fora do ramo
 * federal — o item `cascata_modalidade_fora_do_regime_federal`. Aqui a saída
 * não é configurar a cascata: é corrigir a regra de distribuição ou a
 * modalidade no próprio quadro de vagas, acima nesta mesma tela.
 */
export function ofertasComCascataForaDoRegimeFederal(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): readonly DistribuicaoDeVagas[] {
  return ofertas.filter(
    (oferta) => ofertaExigeCascata(oferta, catalogo) && ofertaForaDoRegimeFederal(oferta),
  );
}

/**
 * Um problema de encaixe entre a matriz da regra e o quadro de vagas.
 *
 * `ofertaCursoId` é `null` para os dois problemas de escopo de **processo**
 * (origem ou destino que a matriz declara e nenhuma oferta cobre) — esses não
 * apontam para uma oferta específica porque nenhuma delas, isoladamente, é
 * "a errada": a matriz inteira é que sobra em relação ao que o processo
 * ofertou.
 */
export interface ProblemaDaCascata {
  readonly ofertaCursoId: string | null;
  readonly mensagem: string;
}

/**
 * Confere a matriz que a regra declara contra o quadro de vagas, em dois
 * níveis (cascata de remanejamento de cotas, UNI-REQ-0056).
 *
 * **Por oferta** — nunca contra a união —, espelhando
 * `FallbackNaoSelecionadoNaOferta` e `DestinoDaOrigemNaoResolvivelNaOferta`:
 * o destino final tem de estar selecionado em cada oferta federal que exige
 * cascata, e cada origem que ela declara com `SEGUE_ORDEM_DE_REMANEJAMENTO` precisa de ao
 * menos um destino, entre os que a regra ordena para ela, também selecionado
 * na mesma oferta.
 *
 * **Sobre a união de todas as ofertas** — espelhando
 * `ExisteCascataOrigemNaoSegueCascata` e `ExisteCascataDestinoDesconhecido`:
 * a tela sempre envia a matriz **inteira** que a regra declara (a cascata
 * de remanejamento não admite matriz parcial), então uma origem ou destino que a regra declara mas
 * nenhuma oferta do processo cobre passa despercebido pela checagem por
 * oferta — e o handler de gravação também não o rejeita, porque
 * `BateComDeclaracaoDaRegra` só confere a matriz contra o `declaracaoDaRegra`, nunca
 * contra o quadro de vagas. Sem esta segunda checagem, o PUT aceita uma
 * cascata que a prontidão de conformidade (`PendenciaDaCascata`) recusa na
 * publicação — silenciosamente, porque `GET /conformidade` não tem tela
 * própria ainda.
 */
export function problemasDaCascata(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  matriz: MatrizDaOrdemDeRemanejamento,
): readonly ProblemaDaCascata[] {
  return [
    ...ofertas
      .filter(
        (oferta) => ofertaExigeCascata(oferta, catalogo) && !ofertaForaDoRegimeFederal(oferta),
      )
      .flatMap((oferta) => problemasDaOferta(oferta, catalogo, matriz)),
    ...problemasDeCoberturaDaMatriz(ofertas, catalogo, matriz),
  ];
}

function problemasDaOferta(
  oferta: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  matriz: MatrizDaOrdemDeRemanejamento,
): readonly ProblemaDaCascata[] {
  const rotulo = rotuladorDe(catalogo);
  const codigos = new Set(oferta.modalidades.map((modalidade) => modalidade.codigo));
  return [
    ...(codigos.has(matriz.fallbackCodigo) ? [] : [fallbackAusente(oferta, matriz, rotulo)]),
    ...problemasDasOrigens(oferta, catalogo, matriz, rotulo),
  ];
}

function problemasDasOrigens(
  oferta: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  matriz: MatrizDaOrdemDeRemanejamento,
  rotulo: Rotulo,
): readonly ProblemaDaCascata[] {
  const codigos = new Set(oferta.modalidades.map((modalidade) => modalidade.codigo));
  const destinos = new Map(matriz.ordens.map((ordem) => [ordem.origem, ordem.destinos]));
  return oferta.modalidades
    .filter((item) => segueCascata(item.id, catalogo))
    .map((item) => recusaDaOrigem(item.codigo, destinos.get(item.codigo), codigos, rotulo))
    .filter((mensagem) => mensagem !== null)
    .map((mensagem) => ({ ofertaCursoId: oferta.ofertaCursoId, mensagem }));
}

function fallbackAusente(
  oferta: DistribuicaoDeVagas,
  matriz: MatrizDaOrdemDeRemanejamento,
  rotulo: Rotulo,
): ProblemaDaCascata {
  return {
    ofertaCursoId: oferta.ofertaCursoId,
    mensagem: `O destino final da cascata (${rotulo(matriz.fallbackCodigo)}) não está selecionado no quadro de vagas desta oferta.`,
  };
}

function recusaDaOrigem(
  origem: string,
  destinos: readonly string[] | undefined,
  codigosDaOferta: ReadonlySet<string>,
  rotulo: Rotulo,
): string | null {
  if (destinos === undefined) {
    return `A modalidade ${rotulo(origem)} segue a cascata, mas a regra escolhida não declara essa origem.`;
  }
  if (destinos.some((destino) => codigosDaOferta.has(destino))) return null;
  return `Nenhum destino de ${rotulo(origem)} (${destinos.map(rotulo).join(', ')}) está selecionado no quadro de vagas desta oferta.`;
}

/**
 * A matriz enviada é sempre inteira: origem ou destino que a regra declara e
 * nenhuma oferta do processo cobre torna o processo impublicável mesmo com o
 * PUT aceito — o handler de gravação não confere isso, só a prontidão de
 * conformidade, na publicação. `union` é deliberadamente **sobre todas as
 * ofertas**, diferente da checagem por oferta acima: uma origem pode ser
 * `SEGUE_ORDEM_DE_REMANEJAMENTO` na oferta A e o destino dela estar ofertado só na B.
 */
function problemasDeCoberturaDaMatriz(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  matriz: MatrizDaOrdemDeRemanejamento,
): readonly ProblemaDaCascata[] {
  const codigosOfertados = new Set(
    ofertas.flatMap((oferta) => oferta.modalidades.map((modalidade) => modalidade.codigo)),
  );
  const rotulo = rotuladorDe(catalogo);
  return [
    ...origensSemMarcaDeCascata(ofertas, catalogo, matriz),
    ...destinosNaoOfertados(codigosOfertados, matriz, rotulo),
    ...destinoFinalNaoOfertado(codigosOfertados, matriz.fallbackCodigo, rotulo),
  ];
}

function destinoFinalNaoOfertado(
  codigos: ReadonlySet<string>,
  destino: string,
  rotulo: Rotulo,
): ProblemaDaCascata[] {
  return codigos.has(destino)
    ? []
    : [
        semOferta(
          `A regra declara ${rotulo(destino)} como destino final, mas nenhuma oferta do processo o oferece no quadro de vagas.`,
        ),
      ];
}

function semOferta(mensagem: string): ProblemaDaCascata {
  return { ofertaCursoId: null, mensagem };
}

function origensSemMarcaDeCascata(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  matriz: MatrizDaOrdemDeRemanejamento,
): readonly ProblemaDaCascata[] {
  const origensSegueCascata = codigosQueSeguemCascata(ofertas, catalogo);
  const rotulo = rotuladorDe(catalogo);
  return matriz.ordens
    .filter((ordem) => !origensSegueCascata.has(ordem.origem))
    .map((ordem) =>
      semOferta(
        `A regra declara a origem ${rotulo(ordem.origem)}, mas nenhuma oferta do processo a marca como seguidora da ordem de remanejamento no quadro de vagas.`,
      ),
    );
}

function codigosQueSeguemCascata(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ReadonlySet<string> {
  return new Set(
    ofertas.flatMap((oferta) =>
      oferta.modalidades
        .filter((modalidade) => segueCascata(modalidade.id, catalogo))
        .map((modalidade) => modalidade.codigo),
    ),
  );
}

// Uma mensagem por destino ausente, não por par origem-destino: no
// catálogo real cada origem repete os mesmos pares como destino umas das
// outras, e listar por origem duplicaria a mesma modalidade faltante uma
// vez por origem que a referencia.
function destinosNaoOfertados(
  codigosOfertados: ReadonlySet<string>,
  matriz: MatrizDaOrdemDeRemanejamento,
  rotulo: Rotulo,
): readonly ProblemaDaCascata[] {
  const destinosDaMatriz = new Set(matriz.ordens.flatMap((ordem) => ordem.destinos));
  const faltantes = [...destinosDaMatriz].filter((destino) => !codigosOfertados.has(destino));
  if (faltantes.length === 0) return [];
  return [
    semOferta(
      `A regra declara os destinos ${faltantes.map(rotulo).join(', ')}, mas nenhuma oferta do processo os oferece no quadro de vagas.`,
    ),
  ];
}

/**
 * O comando de gravação: a matriz inteira que a regra declarou, célula a
 * célula (UNI-REQ-0056) — nunca uma parte da matriz. O handler recusa com
 * `MatrizDivergenteDaRegra` qualquer payload que não seja idêntico ao
 * `declaracaoDaRegra` congelado, então enviar menos do que a regra declara já é
 * recusa certa.
 */
export function comandoDaCascata(
  selecao: CascataSelecionada,
  matriz: MatrizDaOrdemDeRemanejamento,
): DefinirCascataRemanejamentoRequest {
  return {
    regraCodigo: selecao.regraCodigo,
    regraVersao: selecao.regraVersao,
    fallbackCodigo: matriz.fallbackCodigo,
    destinos: matriz.ordens.flatMap(destinosDaOrdem),
  };
}

function destinosDaOrdem(ordem: OrdemDeOrigem): DestinoRemanejamentoInput[] {
  return ordem.destinos.map((destino, indice) => ({
    modalidadeOrigemCodigo: ordem.origem,
    ordem: indice + 1,
    modalidadeDestinoCodigo: destino,
  }));
}

/** Os quatro campos nulos removem a cascata do processo (contrato do handler). */
export function comandoDeRemocaoDaCascata(): DefinirCascataRemanejamentoRequest {
  return { regraCodigo: null, regraVersao: null, fallbackCodigo: null, destinos: null };
}

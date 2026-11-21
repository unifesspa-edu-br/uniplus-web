import type { EtapaPontuada } from '../../../processo-seletivo.models';
import { FORMAS_DE_AVALIACAO } from '../../../shared/forma-de-avaliacao';
import { alvosDoControleDosParametros } from '../../../shared/configuracao-do-recurso/ids-dos-parametros';
import type { CampoDosParametros } from '../../../shared/configuracao-do-recurso/parametros-do-recurso';
import { ehParametroDoRecurso } from '../../../shared/recusas/controle-do-recurso';
import { NO_TOPO_DA_ETAPA } from '../campo-da-etapa';

/** Os códigos das regras de consolidação que a tela oferece, na ordem em que as oferece. */
export type RegrasOferecidas = readonly string[];

type Alvos = (etapa: EtapaPontuada, indice: number, regras: RegrasOferecidas) => readonly string[];

/** O controle e, de reserva, o bloco das recusas dele, na grafia dos `id` do editor da etapa. */
const controleOuBloco =
  (controle: string, bloco: string): Alvos =>
  (_etapa, indice) => [`${controle}-${indice}`, `${bloco}-${indice}`];

const alvosDaForma: Alvos = (etapa, indice) => {
  const forma = etapa.formaDeAvaliacao || FORMAS_DE_AVALIACAO[0].valor;
  return [`cr-etapa-forma-${indice}-${forma}`, `cr-etapa-forma-erro-${indice}`];
};

/** A opção marcada, ou a primeira oferecida quando nenhuma está marcada, e o bloco de reserva. */
const alvosDaRegra: Alvos = (etapa, indice, regras) => {
  const marcada = etapa.regraConsolidacaoCodigo ?? '';
  const opcoes = [marcada, regras[0] ?? ''].filter((codigo) => codigo !== '');
  return [
    ...opcoes.map((codigo) => `cr-etapa-regra-opcao-${indice}-${codigo}`),
    `cr-etapa-regra-erro-${indice}`,
  ];
};

const ALVOS_DOS_CAMPOS: ReadonlyMap<string, Alvos> = new Map<string, Alvos>([
  [NO_TOPO_DA_ETAPA, (_etapa, indice) => [`cr-etapa-recusas-${indice}`]],
  ['notaMinima', controleOuBloco('cr-etapa-nota', 'cr-etapa-nota-erro')],
  ['notaMaxima', controleOuBloco('cr-etapa-nota-maxima', 'cr-etapa-nota-maxima-erro')],
  ['passoDoLancamento', controleOuBloco('cr-etapa-passo', 'cr-etapa-passo-erro')],
  ['formaDeAvaliacao', alvosDaForma],
  ['regraConsolidacao', alvosDaRegra],
  ['itensDeAvaliacao', (_etapa, indice) => [`cr-etapa-${indice}-itens-erro`]],
  ['escalaDeAtendimento', (_etapa, indice) => [`cr-etapa-${indice}-escala-erro`]],
  ['bancas', (_etapa, indice) => [`cr-etapa-bancas-erro-${indice}`]],
]);

/** O sufixo do `id` do controle de cada campo de item das listas de avaliação. */
const CONTROLE_DO_ITEM: ReadonlyMap<string, string> = new Map([
  ['itensDeAvaliacao.rotulo', 'item-{n}-rotulo'],
  ['itensDeAvaliacao.pontuacaoMaxima', 'item-{n}-pontuacao'],
  ['escalaDeAtendimento.rotulo', 'nivel-{n}-rotulo'],
  ['escalaDeAtendimento.fracao', 'nivel-{n}-percentual'],
]);

const ITEM_DA_LISTA = /^(itensDeAvaliacao|escalaDeAtendimento)\.(\d+)\.(\w+)$/;
const CONTROLE_DO_RECURSO = /^recursos\.(\d+)\.(\w+)$/;

function alvosDoItem([, lista, posicao, subcampo]: RegExpExecArray, indice: number): string[] {
  const modelo = CONTROLE_DO_ITEM.get(`${lista}.${subcampo}`) ?? '';
  const controle = `cr-etapa-${indice}-${modelo.replace('{n}', posicao)}`;
  return [controle, `${controle}-erro`];
}

/** O prefixo dos `id` dos parâmetros do recurso, único por recurso de cada etapa. */
export function prefixoDoRecursoDaEtapa(indiceDaEtapa: number, posicao: number): string {
  return `cr-rec-${indiceDaEtapa}-${posicao}`;
}

/** O `id` do bloco que reúne as recusas aos parâmetros do recurso, de reserva ao foco. */
export function blocoDasRecusasDoRecursoDaEtapa(indiceDaEtapa: number, posicao: number): string {
  return `cr-rec-recusas-${indiceDaEtapa}-${posicao}`;
}

/** Os `id` do controle do recurso que não é parâmetro: de onde o prazo corre e a publicação. */
const CONTROLE_FORA_DOS_PARAMETROS: ReadonlyMap<string, (sufixo: string) => string> = new Map([
  ['origemDoPrazo', (sufixo) => `cr-rec-anc-${sufixo}`],
  ['ancora', (sufixo) => `cr-rec-ato-${sufixo}`],
]);

function alvosDoControleForaDosParametros(controle: string, sufixo: string): string[] {
  const reserva = `cr-rec-recusa-${controle}-${sufixo}`;
  const id = CONTROLE_FORA_DOS_PARAMETROS.get(controle)?.(sufixo);
  return id === undefined ? [reserva] : [id, reserva];
}

function alvosDoParametro(
  etapa: EtapaPontuada,
  indice: number,
  posicao: number,
  controle: CampoDosParametros,
): string[] {
  const admite = etapa.recursos[posicao]?.admiteInstanciaSuperior ?? null;
  const prefixo = prefixoDoRecursoDaEtapa(indice, posicao);
  return [
    ...alvosDoControleDosParametros(prefixo, controle, admite),
    blocoDasRecusasDoRecursoDaEtapa(indice, posicao),
  ];
}

function alvosDoRecurso(
  etapa: EtapaPontuada,
  indice: number,
  [, posicao, controle]: RegExpExecArray,
): string[] {
  return ehParametroDoRecurso(controle)
    ? alvosDoParametro(etapa, indice, Number(posicao), controle)
    : alvosDoControleForaDosParametros(controle, `${indice}-${posicao}`);
}

/**
 * Os elementos que podem receber o foco quando a recusa é o primeiro problema do passo, do
 * preferido ao de reserva. O controle vem antes; o bloco das recusas, que aceita foco, serve
 * quando o campo não tem controle onde pôr o foco, como a lista de itens ou a regra recusada sem
 * opção marcada. `indice` é a posição da etapa no formulário, que nomeia os campos dela.
 */
export function alvosDaRecusaDaEtapa(
  campo: string,
  etapa: EtapaPontuada,
  indice: number,
  regras: RegrasOferecidas,
): readonly string[] {
  const item = ITEM_DA_LISTA.exec(campo);
  const recurso = CONTROLE_DO_RECURSO.exec(campo);
  if (item !== null) return alvosDoItem(item, indice);
  if (recurso !== null) return alvosDoRecurso(etapa, indice, recurso);
  return ALVOS_DOS_CAMPOS.get(campo)?.(etapa, indice, regras) ?? [`cr-etapa-recusas-${indice}`];
}

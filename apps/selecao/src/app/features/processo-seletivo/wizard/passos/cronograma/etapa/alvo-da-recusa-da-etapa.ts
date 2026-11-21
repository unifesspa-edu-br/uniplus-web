import type { EtapaPontuada } from '../../../processo-seletivo.models';
import { FORMAS_DE_AVALIACAO } from '../../../shared/forma-de-avaliacao';
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

/** A opção marcada de "admite instância superior", ou a primeira quando nenhuma está marcada. */
function opcaoDaInstanciaSuperior(etapa: EtapaPontuada, posicao: number): string {
  return etapa.recursos[posicao]?.admiteInstanciaSuperior === false ? 'nao' : 'sim';
}

/** Os `id` do controle de cada campo do recurso; `opcao` é a escolha marcada em instância superior. */
const CONTROLE_DO_RECURSO_NA_TELA: ReadonlyMap<
  string,
  (sufixo: string, opcao: string) => readonly string[]
> = new Map([
  ['prazoValor', (sufixo) => [`cr-rec-prazo-${sufixo}`]],
  ['prazoUnidade', (sufixo) => [`cr-rec-un-${sufixo}`]],
  ['origemDoPrazo', (sufixo) => [`cr-rec-anc-${sufixo}`]],
  ['ancora', (sufixo) => [`cr-rec-ato-${sufixo}`]],
  ['suspensividadePrimeiraInstanciaValor', (sufixo) => [`cr-rec-susp1-val-${sufixo}`]],
  ['suspensividadePrimeiraInstanciaUnidade', (sufixo) => [`cr-rec-susp1-un-${sufixo}`]],
  ['suspensividadeSegundaInstanciaValor', (sufixo) => [`cr-rec-susp2-val-${sufixo}`]],
  ['suspensividadeSegundaInstanciaUnidade', (sufixo) => [`cr-rec-susp2-un-${sufixo}`]],
  ['admiteInstanciaSuperior', (sufixo, opcao) => [`cr-rec-superior-${opcao}-${sufixo}`]],
]);

function alvosDoRecurso(
  etapa: EtapaPontuada,
  indice: number,
  [, posicao, controle]: RegExpExecArray,
): string[] {
  const sufixo = `${indice}-${posicao}`;
  const opcao = opcaoDaInstanciaSuperior(etapa, Number(posicao));
  const doControle = CONTROLE_DO_RECURSO_NA_TELA.get(controle)?.(sufixo, opcao) ?? [];
  return [...doControle, `cr-rec-recusa-${controle}-${sufixo}`];
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

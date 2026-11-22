import { FORMA_HUMANA } from '../../shared/forma-de-avaliacao';
import { escalaVale } from '../../shared/itens-de-avaliacao';
import {
  controleDoRecurso,
  type ControleDoRecurso,
  ehDoPrazoDaSegundaInstancia,
} from '../../shared/recusas/controle-do-recurso';
import { prazoDaSegundaInstanciaVisivel } from '../../shared/configuracao-do-recurso/parametros-do-recurso';
import {
  campoDaBancaNoCaminho,
  type CampoDaBanca,
} from '../../shared/deliberacao/recusas-da-regra';
import type { LocalDaRecusa } from '../../shared/recusas/local-da-recusa';
import type { EtapaPontuada } from '../../processo-seletivo.models';
import {
  declaraNotaDoEnem,
  declaraNotaMaxima,
  eliminaPorCarater,
  type TipoDeEtapaDoCatalogo,
} from './regras-da-etapa';

/** O campo das recusas que a etapa recebe mas a tela não mostra num controle: ficam no topo da etapa. */
export const NO_TOPO_DA_ETAPA = '';

/** Os campos da própria etapa que têm controle na tela, ou o grupo que reúne as recusas deles. */
export type CampoDaEtapa =
  | 'notaMinima'
  | 'notaMaxima'
  | 'passoDoLancamento'
  | 'formaDeAvaliacao'
  | 'regraConsolidacao'
  | 'itensDeAvaliacao'
  | 'escalaDeAtendimento'
  | 'bancas';

/** Um campo de um item da lista, na chave `itensDeAvaliacao.2.rotulo`. */
export type CampoDeItemDaEtapa =
  | `itensDeAvaliacao.${number}.${'rotulo' | 'pontuacaoMaxima'}`
  | `escalaDeAtendimento.${number}.${'rotulo' | 'fracao'}`;

/** Um campo da regra de deliberação de uma banca da etapa, na chave `bancas.0.quorum`; `regra` é a regra inteira. */
export type CampoDaBancaDaEtapa = `bancas.${number}.${CampoDaBanca}`;

/** Um controle de um recurso da etapa, na chave `recursos.0.prazo`; `recurso` é o recurso inteiro. */
export type CampoDoRecursoDaEtapa = `recursos.${number}.${ControleDoRecurso | 'recurso'}`;

/**
 * Onde a recusa do servidor aparece na etapa. O nome é o do que a tela mostra: `bancas` reúne as
 * recusas às bancas que não são de um campo da regra de deliberação, e `NO_TOPO_DA_ETAPA` as dos
 * campos que a tela não liga a um controle.
 */
export type CampoDaRecusaDaEtapa =
  | CampoDaEtapa
  | CampoDeItemDaEtapa
  | CampoDaBancaDaEtapa
  | CampoDoRecursoDaEtapa
  | typeof NO_TOPO_DA_ETAPA;

const CAMPOS_DA_ETAPA: ReadonlyMap<string, CampoDaEtapa> = new Map(
  (
    [
      'notaMinima',
      'notaMaxima',
      'passoDoLancamento',
      'formaDeAvaliacao',
      'regraConsolidacao',
      'itensDeAvaliacao',
      'escalaDeAtendimento',
    ] as const
  ).map((campo) => [campo.toLowerCase(), campo]),
);

const REGRA_DE_CONSOLIDACAO = ['regraconsolidacaocodigo', 'regraconsolidacaoversao'];

type ListaDaEtapa = 'itensDeAvaliacao' | 'escalaDeAtendimento' | 'bancas';

/** Os campos de cada item das duas listas que têm controle, pelo nome em minúsculas. */
const CAMPOS_DE_ITEM: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  [
    'itensdeavaliacao',
    new Map([
      ['rotulo', 'rotulo'],
      ['pontuacaomaxima', 'pontuacaoMaxima'],
    ]),
  ],
  [
    'escaladeatendimento',
    new Map([
      ['rotulo', 'rotulo'],
      ['fracao', 'fracao'],
    ]),
  ],
]);

/** O campo de um item da lista; o item sem controle (como o `id`) fica na lista. */
function campoDoItem(lista: CampoDaEtapa, chave: string, [indice, subcampo = '']: string[]) {
  const campo = CAMPOS_DE_ITEM.get(chave)?.get(subcampo.toLowerCase());
  return campo === undefined || indice === undefined
    ? lista
    : (`${lista}.${indice}.${campo}` as CampoDeItemDaEtapa);
}

/**
 * Os campos da própria etapa que a tela mostra mas não liga a um controle de recusa: a recusa a
 * eles fica no topo da etapa. O que não está aqui nem entre os campos com controle não é campo da
 * etapa, e a recusa vai ao resumo do passo.
 */
const CAMPOS_NO_TOPO_DA_ETAPA: ReadonlySet<string> = new Set(
  [
    'nome',
    'carater',
    'tipoEtapaOrigemId',
    'peso',
    'ordem',
    'faseCodigo',
    'produtos',
    'inicio',
    'fim',
    'emiteParecerIndividual',
    'tiposDeDecisao',
    'recursos',
  ].map((campo) => campo.toLowerCase()),
);

/** Os campos do recurso da etapa que a tela mostra sem controle de recusa: ficam no recurso. */
const CAMPOS_DO_RECURSO_SEM_CONTROLE: ReadonlySet<string> = new Set(['procedimentos']);

/** O campo da regra da banca que o caminho aponta; a banca inteira e o tipo dela ficam em `bancas`. */
function campoDaBancaDaEtapa([posicao, ...dentroDaBanca]: string[]): CampoDaRecusaDaEtapa {
  const campo = campoDaBancaNoCaminho(dentroDaBanca);
  return posicao === undefined || campo === null ? 'bancas' : `bancas.${Number(posicao)}.${campo}`;
}

function campoDaPropriaEtapa(caminho: string): CampoDaRecusaDaEtapa | null {
  if (caminho === '') return NO_TOPO_DA_ETAPA;
  const [primeiro, ...resto] = caminho.split('.');
  const chave = primeiro.toLowerCase();
  if (chave === 'bancas') return campoDaBancaDaEtapa(resto);
  const campo = CAMPOS_DA_ETAPA.get(chave);
  if (campo !== undefined) return campoDoItem(campo, chave, resto);
  if (REGRA_DE_CONSOLIDACAO.includes(chave)) return 'regraConsolidacao';
  return CAMPOS_NO_TOPO_DA_ETAPA.has(chave) ? NO_TOPO_DA_ETAPA : null;
}

/**
 * O campo do recurso da etapa. A regra de contagem é a do catálogo, sem controle, e a recusa fica
 * no recurso inteiro, como a dos campos que o recurso tem sem controle de recusa; o campo que o
 * recurso não tem é `null`.
 */
function campoDoRecurso(posicao: number, caminho: string): CampoDoRecursoDaEtapa | null {
  const campo = caminho.split('.')[0];
  const controle = controleDoRecurso(campo);
  if (controle !== null && controle !== 'regra') return `recursos.${posicao}.${controle}`;
  const doRecursoInteiro =
    controle === 'regra' || campo === '' || CAMPOS_DO_RECURSO_SEM_CONTROLE.has(campo.toLowerCase());
  return doRecursoInteiro ? `recursos.${posicao}.recurso` : null;
}

/**
 * O campo da etapa sob o qual a recusa do servidor aparece. `NO_TOPO_DA_ETAPA` é a etapa inteira
 * ou um campo dela que a tela mostra sem controle de recusa; `null` é o caminho que a etapa não
 * conhece, ou que não se lê, e a recusa vai ao resumo do passo.
 */
export function campoDaRecusaDaEtapa(local: LocalDaRecusa): CampoDaRecusaDaEtapa | null {
  if (local.dono !== 'etapa' || local.caminho === null) return null;
  return local.recurso === null
    ? campoDaPropriaEtapa(local.caminho)
    : campoDoRecurso(local.recurso, local.caminho);
}

/** O que a etapa mostra agora, para decidir se há controle onde a recusa possa aparecer. */
interface EtapaNaTela {
  readonly etapa: EtapaPontuada;
  /** A etapa tem nota lançada por banca: declara nota máxima, forma de avaliação e itens. */
  readonly comNota: boolean;
  readonly humana: boolean;
  readonly doEnem: boolean;
}

const TEM_CONTROLE: Readonly<Record<CampoDaEtapa, (tela: EtapaNaTela) => boolean>> = {
  notaMinima: ({ etapa }) => eliminaPorCarater(etapa.carater),
  notaMaxima: ({ comNota }) => comNota,
  formaDeAvaliacao: ({ comNota }) => comNota,
  itensDeAvaliacao: ({ comNota }) => comNota,
  regraConsolidacao: ({ humana }) => humana,
  passoDoLancamento: ({ humana, etapa }) => humana && !escalaVale(etapa),
  escalaDeAtendimento: ({ humana, etapa }) => humana && (etapa.itensDeAvaliacao ?? []).length > 0,
  bancas: ({ doEnem }) => !doEnem,
};

function naTela(etapa: EtapaPontuada, tipo: TipoDeEtapaDoCatalogo | undefined): EtapaNaTela {
  const comNota = declaraNotaMaxima(etapa, tipo);
  return {
    etapa,
    comNota,
    humana: comNota && etapa.formaDeAvaliacao === FORMA_HUMANA,
    doEnem: declaraNotaDoEnem(etapa, tipo),
  };
}

const ITEM_DA_LISTA = /^(itensDeAvaliacao|escalaDeAtendimento|bancas)\.(\d+)\./;
const CONTROLE_DO_RECURSO = /^recursos\.(\d+)\.(.+)$/;

function itemNaTela(tela: EtapaNaTela, lista: ListaDaEtapa, posicao: number): boolean {
  const itens = tela.etapa[lista] ?? [];
  return TEM_CONTROLE[lista](tela) && posicao < itens.length;
}

function recursoNaTela(etapa: EtapaPontuada, posicao: number, controle: string): boolean {
  const recurso = etapa.recursos[posicao];
  if (recurso === undefined) return false;
  return (
    !ehDoPrazoDaSegundaInstancia(controle) ||
    prazoDaSegundaInstanciaVisivel(recurso, recurso.leitura)
  );
}

/**
 * O campo da etapa tem controle na tela. Cada controle depende do que a etapa declara (caráter,
 * tipo, forma de avaliação, itens), e o item de uma lista ou um recurso só existe enquanto a
 * posição dele existe. O topo da etapa vale sempre.
 */
export function campoNaTelaDaEtapa(
  campo: string,
  etapa: EtapaPontuada,
  tipo: TipoDeEtapaDoCatalogo | undefined,
): boolean {
  const item = ITEM_DA_LISTA.exec(campo);
  const recurso = CONTROLE_DO_RECURSO.exec(campo);
  if (item !== null)
    return itemNaTela(naTela(etapa, tipo), item[1] as ListaDaEtapa, Number(item[2]));
  if (recurso !== null) return recursoNaTela(etapa, Number(recurso[1]), recurso[2]);
  const tem = TEM_CONTROLE[campo as CampoDaEtapa] as ((tela: EtapaNaTela) => boolean) | undefined;
  return tem === undefined ? true : tem(naTela(etapa, tipo));
}

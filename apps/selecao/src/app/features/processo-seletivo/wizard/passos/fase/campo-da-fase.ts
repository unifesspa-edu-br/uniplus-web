import type { ExigenciasDaFase } from '../../shared/descricao-da-fase';
import {
  controleDoRecurso,
  type ControleDoRecurso,
} from '../../shared/recusas/controle-do-recurso';
import { campoDaBancaReconhecida } from '../../shared/bancas/campo-da-banca';
import type { LocalDaRecusa } from '../../shared/recusas/local-da-recusa';
import {
  campoDaHomologacao,
  type CampoDaHomologacaoDaFase,
} from './homologacao/campo-da-homologacao';
import type { CampoDaFase } from './configuracao-da-fase';

/** O campo das recusas que a fase recebe mas a tela não mostra num controle: ficam no topo da fase. */
export const NO_TOPO_DA_FASE = '';

/** Um controle da regra de recurso da fase, que a recusa do servidor aponta campo a campo. */
export type CampoDoRecursoDaFase = `recurso.${ControleDoRecurso}`;

/** Um campo de uma linha da lista de publicações, na chave `produtos.1.atoCodigo`; `produtos.1` é a linha inteira. */
export type CampoDaPublicacaoDaFase =
  | `produtos.${number}.${'atoCodigo' | 'papel'}`
  | `produtos.${number}`;

/**
 * Onde a recusa do servidor aparece: os campos que a conferência local já nomeia, mais os que só o
 * servidor recusa. `produtos` é a lista de publicações inteira e `produtos.1.papel` o papel da
 * segunda linha dela. `recurso` é a regra de recurso inteira, para a recusa que não aponta um
 * controle dela, `homologacao.*` o campo da regra de homologação das inscrições, e `NO_TOPO_DA_FASE` é a fase inteira ou um campo dela que a tela mostra sem
 * controle de recusa.
 */
export type CampoDaRecusaDaFase =
  | typeof NO_TOPO_DA_FASE
  | CampoDaFase
  | CampoDaPublicacaoDaFase
  | CampoDoRecursoDaFase
  | CampoDaHomologacaoDaFase
  | 'inicio'
  | 'fim'
  | 'noMesmoMomentoDaAnterior'
  | 'unidadeResponsavelId'
  | 'recurso'
  | `bancasRequeridas.${string}`;

const CAMPOS_DA_FASE: ReadonlyMap<string, CampoDaRecusaDaFase> = new Map(
  (
    [
      'inicio',
      'fim',
      'noMesmoMomentoDaAnterior',
      'unidadeResponsavelId',
      'emiteParecerIndividual',
    ] as const
  ).map((campo) => [campo.toLowerCase(), campo]),
);

/**
 * Os campos da própria fase que a tela mostra mas não liga a um controle de recusa: a recusa a
 * eles fica no topo da fase. O que não está aqui nem entre os campos com controle não é campo da
 * fase, e a recusa vai ao resumo do passo.
 */
const CAMPOS_NO_TOPO_DA_FASE: ReadonlySet<string> = new Set(
  ['ordem', 'faseCanonicaId', 'tiposDeDecisao'].map((campo) => campo.toLowerCase()),
);

/** Os campos de cada linha da lista de publicações que têm controle, pelo nome em minúsculas. */
const CAMPOS_DA_PUBLICACAO: ReadonlyMap<string, 'atoCodigo' | 'papel'> = new Map([
  ['atocodigo', 'atoCodigo'],
  ['papel', 'papel'],
]);

const LINHA_DE_PUBLICACAO = /^produtos\.(\d+)(?:\.|$)/;

/** O que a regra de recurso tem sem controle de recusa: a recusa fica na regra inteira. */
const CAMPOS_DA_REGRA_SEM_CONTROLE: ReadonlySet<string> = new Set(['procedimentosderecurso']);

/** O que cada parte da fase que tem seção própria faz com o resto do caminho da recusa. */
const RAMOS_DA_FASE: ReadonlyMap<string, (resto: string[]) => CampoDaRecusaDaFase | null> = new Map(
  [
    ['regrarecurso', ([campo = '']) => campoDoRecurso(campo)],
    ['produtos', (resto) => campoDaPublicacao(resto)],
    ['regradehomologacao', (resto) => campoDaHomologacao(resto)],
    ['bancasrequeridas', (resto) => campoDaBancaReconhecida('bancasRequeridas', resto)],
  ],
);

/**
 * O campo da fase sob o qual a recusa do servidor aparece. `NO_TOPO_DA_FASE` é a fase inteira ou
 * um campo dela que a tela mostra sem controle de recusa; `null` é o caminho que a fase não
 * conhece, ou que não se lê, e a recusa vai ao resumo do passo.
 */
export function campoDaRecusaDaFase(local: LocalDaRecusa): CampoDaRecusaDaFase | null {
  if (local.dono !== 'fase' || local.caminho === null) return null;
  const [primeiro, ...resto] = local.caminho.split('.');
  const chave = primeiro.toLowerCase();
  const ramo = RAMOS_DA_FASE.get(chave);
  if (ramo !== undefined) return ramo(resto);
  if (chave === '' || CAMPOS_NO_TOPO_DA_FASE.has(chave)) return NO_TOPO_DA_FASE;
  return CAMPOS_DA_FASE.get(chave) ?? null;
}

/**
 * O campo de uma linha da lista de publicações. A linha sem controle para o que foi recusado fica
 * na linha inteira, e a recusa que não diz a posição fica na lista.
 */
function campoDaPublicacao([posicao = '', subcampo = '']: string[]): CampoDaRecusaDaFase {
  if (!/^\d+$/.test(posicao)) return 'produtos';
  const campo = CAMPOS_DA_PUBLICACAO.get(subcampo.toLowerCase());
  const linha = Number(posicao);
  return campo === undefined ? `produtos.${linha}` : `produtos.${linha}.${campo}`;
}

/** A posição da linha de publicações a que o campo se refere; `null` quando ele não é de uma linha. */
export function posicaoDaPublicacao(campo: string): number | null {
  const linha = LINHA_DE_PUBLICACAO.exec(campo);
  return linha === null ? null : Number(linha[1]);
}

/**
 * A recusa a uma linha só aponta a linha enquanto a posição existe na lista de publicações; sem
 * ela, a recusa fica na lista inteira.
 */
export function campoComLinhaNaLista(
  campo: CampoDaRecusaDaFase,
  quantidadeDePublicacoes: number,
): CampoDaRecusaDaFase {
  const posicao = posicaoDaPublicacao(campo);
  return posicao !== null && posicao >= quantidadeDePublicacoes ? 'produtos' : campo;
}

/** O campo da regra de recurso; o campo que ela não tem é `null`. */
function campoDoRecurso(campo: string): CampoDaRecusaDaFase | null {
  const controle = controleDoRecurso(campo);
  if (controle !== null) return `recurso.${controle}`;
  const daRegraInteira = campo === '' || CAMPOS_DA_REGRA_SEM_CONTROLE.has(campo.toLowerCase());
  return daRegraInteira ? 'recurso' : null;
}

/**
 * O Fim da fase está à vista: o período é obrigatório, a publicação exige o Fim, ou há Fim ou
 * recusa a ele. O Fim que existe nunca fica escondido, nem na fase que a tela não sabe descrever.
 */
export function fimDaFaseNaTela(
  exigencias: ExigenciasDaFase | null,
  haFimOuRecusa: boolean,
): boolean {
  return (
    haFimOuRecusa || exigencias?.janelaObrigatoria === true || exigencias?.fimObrigatorio === true
  );
}

export function marcaDoMesmoMomentoNaTela(
  posicao: number,
  ligada: boolean,
  comRecusa: boolean,
): boolean {
  return posicao > 0 || ligada || comRecusa;
}

/**
 * O campo da linha do tempo da fase tem controle na tela. A fase que a tela não sabe descrever não
 * mostra a unidade nem o início: só existem quando se sabe o que a fase exige. O início aparece só
 * com o período obrigatório. O Fim tem sempre onde receber a recusa, porque `fimDaFaseNaTela` o
 * mostra quando há recusa a ele, mesmo sem saber o que a fase exige. Os demais campos da fase têm
 * controle sempre que a fase está aberta; a marca também aparece na primeira quando ligada ou recusada.
 */
export function campoNaTela(campo: string, exigencias: ExigenciasDaFase | null): boolean {
  if (campo === 'unidadeResponsavelId') return exigencias !== null;
  if (campo === 'inicio') return exigencias?.janelaObrigatoria === true;
  return true;
}

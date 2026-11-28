import { type ProblemDetails, recusasDoProblema } from '@uniplus/shared-core/http';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

import { acrescentarRecusaDoControle } from '../../shared/recusas-por-controle';
import { recusaNoPassoDaFormula } from './classificacao-para-comando';

/**
 * O controle da tela que escolhe uma regra do catálogo e que corrige a recusa: um dos três da
 * fórmula ou o da regra de eliminação na posição indicada, base 0, como a API a apontou.
 */
export type ControleDoCatalogo =
  | 'regraCalculo'
  | 'regraArredondamento'
  | 'regraOrdemAlocacao'
  | `regraEliminacao.${number}`;

const CONTROLE_DA_FORMULA: ReadonlyMap<string, ControleDoCatalogo> = new Map([
  ['regracalculocodigo', 'regraCalculo'],
  ['regraarredondamentocodigo', 'regraArredondamento'],
  ['regraordemalocacaocodigo', 'regraOrdemAlocacao'],
]);

const ROTULO_NA_FORMULA: Readonly<Partial<Record<ControleDoCatalogo, string>>> = {
  regraCalculo: 'Regra de cálculo',
  regraArredondamento: 'Regra de arredondamento',
  regraOrdemAlocacao: 'Ordem de alocação',
};

/** O item `regrasEliminacao[i]` do pedido, com ou sem prefixo de caminho, e o campo dele, se houver. */
const ITEM_DE_ELIMINACAO = /(?:^|\.)regrasEliminacao\[(\d+)\](?:\.(\w+))?$/i;

/**
 * A posição, base 0, da regra de eliminação que o campo aponta e o nome do campo do item em minúsculas, quando
 * a recusa é de um campo dele; `undefined` quando o campo não é de um item de `regrasEliminacao`.
 * É o único lugar que lê esse caminho.
 */
export function itemDeEliminacaoDoCampo(
  campo: string,
): { readonly posicao: number; readonly nome?: string } | undefined {
  const [, posicao, nome] = ITEM_DE_ELIMINACAO.exec(campo) ?? [];
  return posicao === undefined
    ? undefined
    : { posicao: Number(posicao), nome: nome?.toLowerCase() };
}

/**
 * O controle que a recusa corrige, reconhecido pelo último segmento do campo e sem diferenciar
 * maiúsculas, como os demais campos da classificação; `undefined` quando o campo não é de uma regra
 * do catálogo ou a posição da regra de eliminação não veio.
 */
export function controleDoCatalogo(campo: string): ControleDoCatalogo | undefined {
  const item = itemDeEliminacaoDoCampo(campo);
  if (item !== undefined) {
    return item.nome === 'regracodigo' ? `regraEliminacao.${item.posicao}` : undefined;
  }
  return CONTROLE_DA_FORMULA.get((campo.split('.').at(-1) ?? campo).toLowerCase());
}

/**
 * As recusas que a API fez à regra citada em cada controle, com a mensagem, o código e a página
 * que ela deu, na ordem recebida e uma só vez por mensagem e código. A recusa de outro campo não
 * entra: aparece só no resumo.
 */
export function recusasDoCatalogo(
  problema: ProblemDetails,
): ReadonlyMap<ControleDoCatalogo, readonly RecusaDoCampo[]> {
  const porControle = new Map<ControleDoCatalogo, RecusaDoCampo[]>();
  for (const { campo, codigo, mensagem, pagina } of recusasDoProblema(problema).deCampo) {
    const controle = controleDoCatalogo(campo);
    if (controle !== undefined) {
      acrescentarRecusaDoControle(porControle, controle, { codigo, mensagem, pagina });
    }
  }
  return porControle;
}

/**
 * O resumo da recusa à regra de um dos três campos da fórmula: a mensagem da API com o nome do
 * campo e o do passo onde corrigi-lo; `null` para qualquer outro campo.
 */
export function recusaDaRegraDaFormula(erro: {
  readonly field: string;
  readonly message: string;
}): string | null {
  const controle = controleDoCatalogo(erro.field);
  const rotulo = controle === undefined ? undefined : ROTULO_NA_FORMULA[controle];
  return rotulo === undefined ? null : recusaNoPassoDaFormula(rotulo, erro.message);
}

/** As recusas sem as dos controles que `retira` aponta. */
export function semOsControles(
  recusas: ReadonlyMap<ControleDoCatalogo, readonly RecusaDoCampo[]>,
  retira: (controle: ControleDoCatalogo) => boolean,
): ReadonlyMap<ControleDoCatalogo, readonly RecusaDoCampo[]> {
  return new Map([...recusas].filter(([chave]) => !retira(chave)));
}

const POSICAO_NO_CONTROLE = /^regraEliminacao\.(\d+)$/;

/**
 * As recusas depois de remover a regra de eliminação da posição: a dela sai, as das posições
 * seguintes descem uma e as da fórmula e das anteriores ficam.
 */
export function semARegraDeEliminacao(
  recusas: ReadonlyMap<ControleDoCatalogo, readonly RecusaDoCampo[]>,
  posicao: number,
): ReadonlyMap<ControleDoCatalogo, readonly RecusaDoCampo[]> {
  const depois = new Map<ControleDoCatalogo, readonly RecusaDoCampo[]>();
  for (const [controle, lista] of recusas) {
    const atual = Number(POSICAO_NO_CONTROLE.exec(controle)?.[1] ?? Number.NaN);
    if (atual === posicao) continue;
    depois.set(atual > posicao ? `regraEliminacao.${atual - 1}` : controle, lista);
  }
  return depois;
}

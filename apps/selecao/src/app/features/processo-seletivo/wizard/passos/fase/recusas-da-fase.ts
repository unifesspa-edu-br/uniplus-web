import type { CausaDeCampo } from '@uniplus/shared-core/http';

import { campoDaRegraNoCaminho, recusaDaRegra } from '../../shared/deliberacao/recusas-da-regra';

import type { CampoDaFase } from './configuracao-da-fase';

/** A unidade responsável escolhida para a fase saiu do cadastro de Organização. */
export const UNIDADE_RESPONSAVEL_NAO_ENCONTRADA =
  'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada';

/** A recusa à regra de deliberação de uma banca, sob o campo dela quando o caminho o aponta. */
export function recusaDaBancaNaFase(
  erro: Pick<CausaDeCampo, 'code' | 'field'> & { readonly message?: string },
): { campo: CampoDaFase; mensagem: string } | undefined {
  const regra = recusaDaRegra(erro.code, erro.message);
  if (regra === null) return undefined;
  const [, posicao] = /bancasRequeridas\[(\d+)\]/i.exec(erro.field) ?? [];
  if (posicao === undefined) return { campo: 'bancasRequeridas', mensagem: regra.mensagem };
  const campo = campoDaRegraNoCaminho(erro.field) ?? regra.campo;
  return { campo: `bancasRequeridas.${Number(posicao)}.${campo}`, mensagem: regra.mensagem };
}

/** A posição da fase no `field` da recusa, ou `null` quando ele não a nomeia. */
export function indiceDaFaseEm(field: string): number | null {
  const casamento = /^(?:\$\.|request\.)?fases\[(\d+)\]/i.exec(field);
  if (casamento === null) return null;
  const indice = Number(casamento[1]);
  return Number.isInteger(indice) ? indice : null;
}

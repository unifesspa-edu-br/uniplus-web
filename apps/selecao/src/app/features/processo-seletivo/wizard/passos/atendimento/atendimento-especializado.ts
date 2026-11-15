import type { CondicaoAtendimentoDto } from '@uniplus/shared-data/configuracao';

import type {
  AtendimentoCondicaoSelecionada,
  ReferenciaDeAtendimento,
} from '../../processo-seletivo.models';
import { CODIGO_CONDICAO_PCD } from './catalogos-de-atendimento.service';

/** O que muda na oferta: as condições e, quando a condição PcD deixa de valer, os tipos de deficiência. */
export interface AlteracaoDaOferta {
  readonly condicoes: readonly AtendimentoCondicaoSelecionada[];
  readonly tiposDeficiencia?: readonly ReferenciaDeAtendimento[];
}

/**
 * A regra do PcD é bicondicional (ADR-0067): tipos de deficiência só valem com a condição de
 * código canônico `PCD` entre as condições. O código decide, e não o catálogo: o rascunho já
 * guarda o código de cada condição selecionada.
 */
export function ehPcd(codigo: string): boolean {
  return codigo.toUpperCase() === CODIGO_CONDICAO_PCD;
}

function restaPcd(condicoes: readonly AtendimentoCondicaoSelecionada[]): boolean {
  return condicoes.some((item) => ehPcd(item.codigo));
}

/**
 * Desmarcar a condição PcD esvazia os tipos de deficiência: sem ela o servidor recusa qualquer
 * tipo ofertado. Só quando, depois da desmarcação, não resta outra condição PcD (a removida
 * hidratada e a ativa que a substituiu satisfazem o pré-requisito juntas).
 */
export function aposMarcarCondicao(
  atuais: readonly AtendimentoCondicaoSelecionada[],
  condicao: AtendimentoCondicaoSelecionada,
  marcada: boolean,
): AlteracaoDaOferta {
  const condicoes = marcada
    ? [...atuais, condicao]
    : atuais.filter((item) => item.id !== condicao.id);

  return !marcada && ehPcd(condicao.codigo) && !restaPcd(condicoes)
    ? { condicoes, tiposDeficiencia: [] }
    : { condicoes };
}

/**
 * Marca ou desmarca de uma vez só as condições ativas. As removidas preservadas no rascunho não são
 * tocadas, e os tipos de deficiência saem se, depois da alteração, nenhuma condição PcD restar.
 */
export function aposMarcarTodas(
  removidas: readonly AtendimentoCondicaoSelecionada[],
  ativas: readonly AtendimentoCondicaoSelecionada[],
  marcar: boolean,
): AlteracaoDaOferta {
  const condicoes = marcar ? [...removidas, ...ativas] : [...removidas];
  return restaPcd(condicoes) ? { condicoes } : { condicoes, tiposDeficiencia: [] };
}

/**
 * Remover uma condição removida também esvazia os tipos de deficiência quando ela era a PcD e
 * nenhuma outra condição PcD resta: sem isso a validação continuaria recusando o passo sem nenhum
 * controle na tela capaz de desfazer a causa.
 */
export function aposRemover(
  atuais: readonly AtendimentoCondicaoSelecionada[],
  id: string,
): AlteracaoDaOferta {
  const removida = atuais.find((item) => item.id === id);
  const condicoes = atuais.filter((item) => item.id !== id);

  return removida !== undefined && ehPcd(removida.codigo) && !restaPcd(condicoes)
    ? { condicoes, tiposDeficiencia: [] }
    : { condicoes };
}

export function comoCondicaoSelecionada(
  condicao: Pick<CondicaoAtendimentoDto, 'id' | 'codigo' | 'nome'>,
): AtendimentoCondicaoSelecionada {
  return { id: condicao.id, codigo: condicao.codigo, nome: condicao.nome };
}

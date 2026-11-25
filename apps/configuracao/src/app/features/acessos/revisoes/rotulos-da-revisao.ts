import {
  QuemDecideOItem,
  SituacaoDaRevisaoCodigo,
  SituacaoDoItemDaRevisao,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

export interface RotuloDaRevisao {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACAO_DA_REVISAO: Readonly<Record<SituacaoDaRevisaoCodigo, RotuloDaRevisao>> = {
  [SituacaoDaRevisaoCodigo.EM_ANDAMENTO]: { texto: 'Aberta', variante: 'warning' },
  [SituacaoDaRevisaoCodigo.CONCLUIDA]: { texto: 'Encerrada', variante: 'neutral' },
};

const SITUACAO_DO_ITEM: Readonly<Record<SituacaoDoItemDaRevisao, RotuloDaRevisao>> = {
  [SituacaoDoItemDaRevisao.PENDENTE]: { texto: 'Aguarda decisão', variante: 'info' },
  [SituacaoDoItemDaRevisao.CONFIRMADA]: { texto: 'Acesso mantido', variante: 'success' },
  [SituacaoDoItemDaRevisao.REVOGADA]: { texto: 'Acesso revogado', variante: 'danger' },
  [SituacaoDoItemDaRevisao.CONCESSAO_ENCERRADA]: {
    texto: 'Concessão encerrada fora da revisão',
    variante: 'neutral',
  },
};

/** Os papéis pela função, no masculino genérico (ADR-0162). */
const QUEM_DECIDE: Readonly<Record<QuemDecideOItem, string>> = {
  [QuemDecideOItem.REPRESENTANTE_DO_CONTROLADOR]: 'Representante do controlador',
  [QuemDecideOItem.GESTOR_DE_ACESSOS]: 'Gestão de acessos',
};

/** O que o filtro da lista oferece; a API filtra pela situação, e "todas" não manda o parâmetro. */
export const OPCOES_DO_FILTRO = [
  { valor: 'todas', texto: 'Todas' },
  { valor: SituacaoDaRevisaoCodigo.EM_ANDAMENTO, texto: 'Abertas' },
  { valor: SituacaoDaRevisaoCodigo.CONCLUIDA, texto: 'Encerradas' },
] as const;

export type FiltroDaRevisao = (typeof OPCOES_DO_FILTRO)[number]['valor'];

export function situacaoDaRevisao(situacao: SituacaoDaRevisaoCodigo): RotuloDaRevisao {
  return SITUACAO_DA_REVISAO[situacao];
}

export function situacaoDoItem(situacao: SituacaoDoItemDaRevisao): RotuloDaRevisao {
  return SITUACAO_DO_ITEM[situacao];
}

export function quemDecide(quem: QuemDecideOItem): string {
  return QUEM_DECIDE[quem];
}

export function pendentes(quantidade: number): string {
  return quantidade === 1 ? '1 pendente' : `${quantidade} pendentes`;
}

export function itens(quantidade: number): string {
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

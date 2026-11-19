import type {
  QuemDecideOItem,
  SituacaoDaRevisao,
  SituacaoDoItemDaRevisao,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

export interface RotuloDaRevisao {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACAO_DA_REVISAO: Readonly<Record<SituacaoDaRevisao, RotuloDaRevisao>> = {
  em_andamento: { texto: 'Aberta', variante: 'warning' },
  concluida: { texto: 'Encerrada', variante: 'neutral' },
};

const SITUACAO_DO_ITEM: Readonly<Record<SituacaoDoItemDaRevisao, RotuloDaRevisao>> = {
  pendente: { texto: 'Aguarda decisão', variante: 'info' },
  confirmada: { texto: 'Acesso mantido', variante: 'success' },
  revogada: { texto: 'Acesso revogado', variante: 'danger' },
  concessao_encerrada: { texto: 'Concessão encerrada fora da revisão', variante: 'neutral' },
};

/** Os papéis pela função, no masculino genérico (ADR-0162). */
const QUEM_DECIDE: Readonly<Record<QuemDecideOItem, string>> = {
  'representante-do-controlador': 'Representante do controlador',
  'gestor-de-acessos': 'Gestão de acessos',
};

/** O que o filtro da lista oferece; a API filtra pela situação, e "todas" não manda o parâmetro. */
export const OPCOES_DO_FILTRO = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'em_andamento', texto: 'Abertas' },
  { valor: 'concluida', texto: 'Encerradas' },
] as const;

export type FiltroDaRevisao = (typeof OPCOES_DO_FILTRO)[number]['valor'];

export function situacaoDaRevisao(situacao: SituacaoDaRevisao): RotuloDaRevisao {
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

import type { UiTagVariant } from '@uniplus/shared-ui/components';

export interface RotuloDaRevisao {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACAO_DA_REVISAO: Readonly<Record<string, RotuloDaRevisao>> = {
  em_andamento: { texto: 'Aberta', variante: 'warning' },
  concluida: { texto: 'Encerrada', variante: 'neutral' },
};

const SITUACAO_DO_ITEM: Readonly<Record<string, RotuloDaRevisao>> = {
  pendente: { texto: 'Aguarda decisão', variante: 'info' },
  confirmada: { texto: 'Acesso mantido', variante: 'success' },
  revogada: { texto: 'Acesso revogado', variante: 'danger' },
  concessao_encerrada: { texto: 'Concessão encerrada fora da revisão', variante: 'neutral' },
};

/** Os papéis pela função, no masculino genérico (ADR-0162). */
const QUEM_DECIDE: Readonly<Record<string, string>> = {
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

/** A situação que a tela não conhece aparece pelo código, neutra. */
export function situacaoDaRevisao(codigo: string): RotuloDaRevisao {
  return SITUACAO_DA_REVISAO[codigo] ?? { texto: codigo, variante: 'neutral' };
}

export function situacaoDoItem(codigo: string): RotuloDaRevisao {
  return SITUACAO_DO_ITEM[codigo] ?? { texto: codigo, variante: 'neutral' };
}

export function quemDecide(codigo: string): string {
  return QUEM_DECIDE[codigo] ?? codigo;
}

export function pendentes(quantidade: number): string {
  return quantidade === 1 ? '1 pendente' : `${quantidade} pendentes`;
}

export function itens(quantidade: number): string {
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

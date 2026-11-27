import {
  SituacaoDaRevisaoCodigo,
  SituacaoDoItemDaRevisaoCodigo,
} from '@uniplus/shared-data/autorizacao';
import type { VariantesDosCodigos } from '@uniplus/shared-ui/components';

/** A cor da etiqueta da situação da revisão; o texto é o rótulo da API. */
export const VARIANTES_DA_REVISAO: VariantesDosCodigos<SituacaoDaRevisaoCodigo> = {
  [SituacaoDaRevisaoCodigo.EM_ANDAMENTO]: 'warning',
  [SituacaoDaRevisaoCodigo.CONCLUIDA]: 'neutral',
};

/** A cor da etiqueta da situação do item; o texto é o rótulo da API. */
export const VARIANTES_DO_ITEM: VariantesDosCodigos<SituacaoDoItemDaRevisaoCodigo> = {
  [SituacaoDoItemDaRevisaoCodigo.PENDENTE]: 'info',
  [SituacaoDoItemDaRevisaoCodigo.CONFIRMADA]: 'success',
  [SituacaoDoItemDaRevisaoCodigo.REVOGADA]: 'danger',
  [SituacaoDoItemDaRevisaoCodigo.CONCESSAO_ENCERRADA]: 'neutral',
};

/**
 * O que o filtro da lista oferece; a API filtra pela situação, e "todas" não manda o parâmetro. O
 * texto repete o rótulo que a API devolve na linha, para a opção e o resultado dizerem o mesmo.
 */
export const OPCOES_DO_FILTRO = [
  { valor: 'todas', texto: 'Todas' },
  { valor: SituacaoDaRevisaoCodigo.EM_ANDAMENTO, texto: 'Em andamento' },
  { valor: SituacaoDaRevisaoCodigo.CONCLUIDA, texto: 'Concluída' },
] as const;

export type FiltroDaRevisao = (typeof OPCOES_DO_FILTRO)[number]['valor'];

export function pendentes(quantidade: number): string {
  return quantidade === 1 ? '1 pendente' : `${quantidade} pendentes`;
}

export function itens(quantidade: number): string {
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

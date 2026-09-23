import type { UiTagVariant } from '@uniplus/shared-ui/components';

/**
 * Contrato de Publicações compartilhado pela listagem, pelo detalhe e pela
 * página do documento. Fica quando a consulta pública da API chegar; só o dado
 * simulado (`publicacoes.mock.ts`) e o repositório mudam. `encerrado` é a única
 * situação "finalizada": é o que a listagem usa para esconder o processo.
 */
export type SituacaoPublicacao =
  | 'inscricoesAbertas'
  | 'emHomologacao'
  | 'resultadoPreliminar'
  | 'resultadoDivulgado'
  | 'encerrado';

export const SITUACAO_PUBLICACAO_LABEL: Record<SituacaoPublicacao, string> = {
  inscricoesAbertas: 'Inscrições abertas',
  emHomologacao: 'Em homologação',
  resultadoPreliminar: 'Resultado preliminar',
  resultadoDivulgado: 'Resultado divulgado',
  encerrado: 'Encerrado',
};

export const SITUACAO_PUBLICACAO_VARIANT: Record<SituacaoPublicacao, UiTagVariant> = {
  inscricoesAbertas: 'info',
  emHomologacao: 'warning',
  resultadoPreliminar: 'warning',
  resultadoDivulgado: 'success',
  encerrado: 'neutral',
};

/** Ordem de exibição dos chips na Tela 1 — `encerrado` fica de fora: a lista nunca traz um item nessa situação. */
export const SITUACOES_PUBLICACAO_EXIBIDAS: readonly SituacaoPublicacao[] = [
  'inscricoesAbertas',
  'emHomologacao',
  'resultadoPreliminar',
  'resultadoDivulgado',
];

/** Categoria do evento na linha do tempo — vira a etiqueta colorida do cartão. */
export type CategoriaEvento =
  | 'edital'
  | 'inscricoes'
  | 'homologacao'
  | 'resultadoPreliminar'
  | 'recursos'
  | 'resultado'
  | 'encerramento';

export const CATEGORIA_EVENTO_LABEL: Record<CategoriaEvento, string> = {
  edital: 'Edital',
  inscricoes: 'Inscrições',
  homologacao: 'Homologação',
  resultadoPreliminar: 'Resultado preliminar',
  recursos: 'Recursos',
  resultado: 'Resultado',
  encerramento: 'Encerramento',
};

export const CATEGORIA_EVENTO_VARIANT: Record<CategoriaEvento, UiTagVariant> = {
  edital: 'primary',
  inscricoes: 'info',
  homologacao: 'neutral',
  resultadoPreliminar: 'warning',
  recursos: 'danger',
  resultado: 'success',
  encerramento: 'neutral',
};

export interface EventoHistoricoPublicacao {
  readonly id: string;
  readonly categoria: CategoriaEvento;
  /** Data no formato `AAAA-MM-DD`, lida pelo `dateBr`. */
  readonly data: string;
  readonly titulo: string;
  readonly descricao?: string;
  /** Nome do PDF relacionado. Nem todo evento tem documento — uma mudança de situação pode não ter um PDF associado. */
  readonly documentoArquivo?: string;
}

export interface Publicacao {
  readonly id: string;
  readonly numeroEdital: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly situacao: SituacaoPublicacao;
  /** Data do evento mais recente do histórico — mostrada na Tela 1. */
  readonly dataPublicacao: string;
  readonly historico: readonly EventoHistoricoPublicacao[];
}

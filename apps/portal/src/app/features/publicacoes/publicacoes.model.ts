import type { UiTagVariant } from '@uniplus/shared-ui/components';

/**
 * Contrato de Publicações compartilhado pelo accordion "Ver publicações" de
 * cada edital (em /processos) e pela página do documento. Fica quando a
 * consulta pública da API chegar; só o dado simulado (`publicacoes.mock.ts`)
 * e o repositório mudam.
 */
export type SituacaoPublicacao =
  | 'inscricoesAbertas'
  | 'emHomologacao'
  | 'resultadoPreliminar'
  | 'resultadoDivulgado'
  | 'encerrado';

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
  /** Data do evento mais recente do histórico. */
  readonly dataPublicacao: string;
  readonly historico: readonly EventoHistoricoPublicacao[];
}

/**
 * Evento do edital de abertura — o mais antigo de categoria `edital` que tem
 * documento. É o alvo do link "Ler o edital de abertura" de cada item de
 * Editais; retificações posteriores também são `edital`, mas não abrem a
 * publicação.
 */
export function eventoDoEditalDeAbertura(
  publicacao: Publicacao | undefined,
): EventoHistoricoPublicacao | undefined {
  return publicacao?.historico
    .filter((evento) => evento.categoria === 'edital' && evento.documentoArquivo)
    .sort((a, b) => a.data.localeCompare(b.data))[0];
}

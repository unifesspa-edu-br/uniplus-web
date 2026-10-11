/**
 * Publicações de um certame, como o accordion "Ver publicações" e o link "Ver edital" (em
 * /processos) as mostram: só os atos publicados, cada um com o PDF no acervo público quando houver.
 * Marcos do cronograma, como a abertura das inscrições, não entram (decisão registrada na
 * uniplus-api#1648).
 */
export interface PublicacaoDoCertame {
  readonly id: string;
  /** Data de publicação do ato (AAAA-MM-DD), uma data de calendário sem fuso. */
  readonly data: string;
  readonly titulo: string;
  /** Nome do tipo do ato — vira a etiqueta do cartão. */
  readonly tipo: string;
  /** Motivo da retificação; os demais atos não têm descrição. */
  readonly descricao?: string;
  /** Endereço público do PDF do ato, quando o acervo já o tem. */
  readonly documentoUrl?: string;
}

export interface PublicacoesDoCertame {
  /** Endereço público do edital vigente — o alvo do "Ver edital". */
  readonly documentoEditalUrl?: string;
  /** Presente quando a linha do tempo pode estar incompleta; a lista vem assim mesmo. */
  readonly aviso?: string;
  /** Mais recente primeiro, na ordem do contrato. */
  readonly publicacoes: readonly PublicacaoDoCertame[];
}

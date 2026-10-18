/**
 * Publicações de um certame, como o accordion "Ver publicações" e o link "Ver edital" (em
 * /processos) as mostram: só os atos publicados, cada um com os documentos no acervo público quando houver.
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
  /**
   * Documentos do ato no acervo. Sem principal nem anexos, o acervo ainda não os tem: a cópia
   * acontece logo depois do registro do ato.
   */
  readonly documentos: DocumentosDaPublicacao;
}

/** Um arquivo do acervo público, com o formato e o tamanho já legíveis. */
export interface DocumentoDaPublicacao {
  readonly nome: string;
  /** Rótulo do formato, como "PDF" ou "DOCX". */
  readonly formato: string;
  /** Tamanho legível, como "1,2 MB". */
  readonly tamanho: string;
  readonly url: string;
}

export interface DocumentosDaPublicacao {
  readonly principal?: DocumentoDaPublicacao;
  readonly anexos: readonly DocumentoDaPublicacao[];
}

export interface PublicacoesDoCertame {
  /** Endereço público do edital vigente — o alvo do "Ver edital". */
  readonly documentoEditalUrl?: string;
  /** Presente quando a linha do tempo pode estar incompleta; a lista vem assim mesmo. */
  readonly aviso?: string;
  /** Mais recente primeiro, na ordem do contrato. */
  readonly publicacoes: readonly PublicacaoDoCertame[];
}

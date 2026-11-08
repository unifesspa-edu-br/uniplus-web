import type { ProblemDetails } from '@uniplus/shared-core/http';

/** Uma leitura que a página explica em vez de tentar de novo: o título e o texto para a pessoa. */
export interface RecusaDoComprovante {
  readonly titulo: string;
  readonly texto: string;
}

/**
 * Como o app explica a recusa ao público dele: o texto de quem não encontra o comprovante e a
 * tradução das recusas da API que repetir não resolve. O que `explicar` devolve nulo segue como
 * falha, com "Tentar novamente".
 */
export interface RecusasDoComprovante {
  readonly naoEncontrado: RecusaDoComprovante;
  readonly explicar: (problema: ProblemDetails) => RecusaDoComprovante | null;
}

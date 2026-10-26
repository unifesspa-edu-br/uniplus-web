/** Onde uma leitura do servidor está: em curso, falhou (com o texto da recusa) ou trouxe os dados. */
export type Leitura<T> =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'falha'; readonly mensagem: string }
  | { readonly estado: 'lido'; readonly dados: T };

export const LENDO: Leitura<never> = { estado: 'lendo' };

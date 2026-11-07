/** Onde uma leitura do servidor está: em curso, falhou (com o texto da recusa) ou trouxe os dados. */
export type Leitura<T> =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'falha'; readonly mensagem: string }
  | { readonly estado: 'lido'; readonly dados: T };

export const LENDO: Leitura<never> = { estado: 'lendo' };

/** O texto da recusa quando a leitura falhou; `null` nos demais estados. */
export function mensagemDaFalha(leitura: Leitura<unknown>): string | null {
  return leitura.estado === 'falha' ? leitura.mensagem : null;
}

/** A leitura está em curso, a primeira vez ou a de uma nova tentativa que apagou a falha. */
export function estaLendo(leitura: Leitura<unknown>): boolean {
  return leitura.estado === 'lendo';
}

/**
 * Numera as leituras de uma mesma fonte: só a mais recente aplica o resultado, porque a resposta
 * de uma leitura antiga pode chegar depois da nova.
 */
export class LeiturasEmOrdem {
  private ultima = 0;

  /** Começa uma leitura, invalidando as anteriores; devolve se ela ainda é a mais recente. */
  iniciar(): () => boolean {
    const minha = ++this.ultima;
    return () => minha === this.ultima;
  }

  /** Invalida a leitura em curso sem começar outra. */
  descartar(): void {
    this.ultima++;
  }
}

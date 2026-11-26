/** O que interessa da credencial de renovação decodificada: os instantes, em segundos do servidor. */
export interface CredencialDeRenovacao {
  readonly exp?: number;
  readonly iat?: number;
}

export type LimiteDaSessao = 'inatividade' | 'periodoMaximo';

/** Até quando a credencial de renovação vale, tudo derivado do que o provedor informou ao entrar. */
export interface PrazoDaCredencial {
  /** O vencimento, em milissegundos no relógio deste navegador. */
  readonly venceEm: number;
  /** Quanto o provedor concedeu nesta emissão, em milissegundos. */
  readonly concedidoMs: number;
  /** O maior prazo concedido visto nesta aba: a base do que o provedor admite sem uso. */
  readonly maiorConcedidoMs: number;
  readonly limite: LimiteDaSessao;
}

const MILISSEGUNDOS_POR_SEGUNDO = 1000;

/**
 * Lê o prazo da credencial de renovação. Sem `exp` e `iat` não há prazo a avisar. O período
 * máximo da sessão não está em token algum: ele se revela quando o provedor concede menos do que
 * já concedeu, e dali em diante o limite continua sendo o período máximo.
 */
export function lerPrazoDaCredencial(
  credencial: CredencialDeRenovacao | undefined,
  diferencaDeRelogioEmSegundos: number,
  anterior: PrazoDaCredencial | null,
): PrazoDaCredencial | null {
  const { exp, iat } = credencial ?? {};
  if (exp === undefined || iat === undefined) return null;
  const concedidoMs = (exp - iat) * MILISSEGUNDOS_POR_SEGUNDO;
  return {
    venceEm: (exp + diferencaDeRelogioEmSegundos) * MILISSEGUNDOS_POR_SEGUNDO,
    concedidoMs,
    maiorConcedidoMs: Math.max(anterior?.maiorConcedidoMs ?? 0, concedidoMs),
    limite: limiteObservado(concedidoMs, anterior),
  };
}

function limiteObservado(concedidoMs: number, anterior: PrazoDaCredencial | null): LimiteDaSessao {
  if (anterior === null) return 'inatividade';
  const concedeuMenos = concedidoMs < anterior.maiorConcedidoMs;
  return concedeuMenos || anterior.limite === 'periodoMaximo' ? 'periodoMaximo' : 'inatividade';
}

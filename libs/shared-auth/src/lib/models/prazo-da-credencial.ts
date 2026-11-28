/** O que interessa da credencial de renovação decodificada: o vencimento, em segundos do servidor. */
export interface CredencialDeRenovacao {
  readonly exp?: number;
}

export type LimiteDaSessao = 'inatividade' | 'periodoMaximo';

/** Até quando a credencial de renovação vale, tudo derivado do que o provedor informou ao entrar. */
export interface PrazoDaCredencial {
  /** O vencimento, em milissegundos no relógio deste navegador. */
  readonly venceEm: number;
  readonly limite: LimiteDaSessao;
}

const MILISSEGUNDOS_POR_SEGUNDO = 1000;

/**
 * Quanto antes do fim do período máximo o vencimento da credencial ainda conta como o próprio
 * período máximo: o provedor pode arredondar o instante da autenticação ou do vencimento.
 */
export const MARGEM_DO_PERIODO_MAXIMO_EM_SEGUNDOS = 120;

/**
 * Lê o prazo da credencial de renovação. Sem `exp` não há prazo a avisar. O limite é o período
 * máximo quando o vencimento chega ao instante da autenticação mais esse período; qualquer outra
 * situação, inclusive instante da autenticação ausente, é tratada como inatividade, o limite que o
 * pedido de mais tempo pode estender. Só os segundos do servidor entram na classificação: a
 * diferença de relógio corrige apenas o vencimento no relógio deste navegador.
 */
export function lerPrazoDaCredencial(
  credencial: CredencialDeRenovacao | undefined,
  autenticadoEmSegundos: number | undefined,
  diferencaDeRelogioEmSegundos: number,
  periodoMaximoEmSegundos: number,
): PrazoDaCredencial | null {
  const exp = credencial?.exp;
  if (exp === undefined) return null;
  return {
    venceEm: (exp + diferencaDeRelogioEmSegundos) * MILISSEGUNDOS_POR_SEGUNDO,
    limite: limiteDaSessao(exp, autenticadoEmSegundos, periodoMaximoEmSegundos),
  };
}

function limiteDaSessao(
  exp: number,
  autenticadoEmSegundos: number | undefined,
  periodoMaximoEmSegundos: number,
): LimiteDaSessao {
  if (autenticadoEmSegundos === undefined) return 'inatividade';
  const fimDoPeriodo = autenticadoEmSegundos + periodoMaximoEmSegundos;
  return exp >= fimDoPeriodo - MARGEM_DO_PERIODO_MAXIMO_EM_SEGUNDOS
    ? 'periodoMaximo'
    : 'inatividade';
}

/** O que interessa do token de acesso decodificado: os instantes, em segundos do servidor. */
export interface TokenDeAcesso {
  readonly exp?: number;
  readonly iat?: number;
}

/** Quando o acesso atual foi emitido e quando vence, em milissegundos no relógio deste navegador. */
export interface PrazoDoAcesso {
  readonly emitidoEm: number;
  readonly venceEm: number;
}

/** Lê o prazo do acesso, corrigindo a diferença entre o relógio do servidor e o deste navegador. */
export function lerPrazoDoAcesso(
  token: TokenDeAcesso | undefined,
  diferencaDeRelogioEmSegundos: number,
): PrazoDoAcesso | null {
  const { exp, iat } = token ?? {};
  if (exp === undefined || iat === undefined) return null;
  return {
    emitidoEm: (iat + diferencaDeRelogioEmSegundos) * MILISSEGUNDOS_POR_SEGUNDO,
    venceEm: (exp + diferencaDeRelogioEmSegundos) * MILISSEGUNDOS_POR_SEGUNDO,
  };
}

/**
 * A antecedência configurada, limitada à metade da duração do acesso: uma antecedência maior que
 * a duração faria cada acesso recém-renovado já nascer na hora de renovar, e a renovação não
 * pararia. Sem prazo conhecido, vale a configurada.
 */
export function antecedenciaEfetivaEmSegundos(
  configuradaEmSegundos: number,
  acesso: PrazoDoAcesso | null,
): number {
  if (acesso === null) return configuradaEmSegundos;
  const metadeDaDuracaoEmSegundos =
    (acesso.venceEm - acesso.emitidoEm) / 2 / MILISSEGUNDOS_POR_SEGUNDO;
  return Math.min(configuradaEmSegundos, metadeDaDuracaoEmSegundos);
}

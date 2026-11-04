import { SituacaoDoCertame } from '@uniplus/shared-data/selecao';

/**
 * Contagem por situação (headers `X-Certames-*`, só vêm com
 * `incluir_contadores=true`). O valor é `undefined` quando o header não veio:
 * "o servidor não contou" e "existem zero certames" dizem coisas diferentes ao
 * candidato, e só o segundo é um zero.
 */
export interface ContadoresSituacao {
  readonly [situacao: string]: number | undefined;
}

type LeitorDeHeaders = { get(name: string): string | null } | undefined;

function numeroDoHeader(headers: LeitorDeHeaders, nome: string): number | undefined {
  const bruto = headers?.get(nome);
  if (bruto === null || bruto === undefined || bruto.trim().length === 0) {
    return undefined;
  }
  const valor = Number(bruto);
  return Number.isFinite(valor) ? valor : undefined;
}

export function contadoresDosHeaders(headers: LeitorDeHeaders): ContadoresSituacao {
  return {
    [SituacaoDoCertame.emBreve]: numeroDoHeader(headers, 'X-Certames-Em-Breve'),
    [SituacaoDoCertame.inscricoesAbertas]: numeroDoHeader(headers, 'X-Certames-Inscricoes-Abertas'),
    [SituacaoDoCertame.ultimosDias]: numeroDoHeader(headers, 'X-Certames-Ultimos-Dias'),
    [SituacaoDoCertame.encerradas]: numeroDoHeader(headers, 'X-Certames-Encerrados'),
  };
}

import { CLIENT_PROBLEM_CODES, type ProblemDetails } from './problem-details';

/**
 * O que a pessoa informa ao suporte para ele achar o erro nos registros do sistema. Vem da resposta
 * do servidor (`servidor`) ou, quando a própria tela detecta o erro sem ter feito pedido, do código
 * que a tela conhece (`tela`).
 */
export type ReferenciaAoSuporte =
  | {
      readonly origem: 'servidor';
      readonly codigoDoErro: string | null;
      readonly identificadorDoPedido: string | null;
    }
  | { readonly origem: 'tela'; readonly codigo: string };

const FORMATO_DO_CODIGO = /^[a-z]+(\.[a-z_]+)+$/;
const FORMATO_DO_IDENTIFICADOR = /^[0-9a-f]{32}$/i;
const CODIGOS_DO_CLIENTE: readonly string[] = Object.values(CLIENT_PROBLEM_CODES);

/** Devolve `valor` só se ele tem o formato que a API garante; qualquer outra coisa não vai ao suporte. */
function somenteNoFormato(valor: string | undefined, formato: RegExp): string | null {
  return valor !== undefined && formato.test(valor) ? valor : null;
}

/** O identificador do pedido (32 hexadecimais), ou `null` quando a resposta não o traz nesse formato. */
export function identificadorDoPedido(problema: ProblemDetails): string | null {
  return somenteNoFormato(problema.traceId, FORMATO_DO_IDENTIFICADOR);
}

/** O código sintético do cliente (falha de rede, resposta fora do contrato) não existe nos registros do servidor. */
function codigoDoServidor(problema: ProblemDetails): string | null {
  if (CODIGOS_DO_CLIENTE.includes(problema.code)) return null;
  return somenteNoFormato(problema.code, FORMATO_DO_CODIGO);
}

/**
 * A referência que a pessoa leva ao suporte, com o código e o identificador que a resposta traz no
 * formato da API. `null` quando nenhum dos dois serve: a tela nunca mostra campo vazio.
 */
export function referenciaDaRecusa(problema: ProblemDetails): ReferenciaAoSuporte | null {
  const codigoDoErro = codigoDoServidor(problema);
  const identificador = identificadorDoPedido(problema);
  if (codigoDoErro === null && identificador === null) return null;
  return { origem: 'servidor', codigoDoErro, identificadorDoPedido: identificador };
}

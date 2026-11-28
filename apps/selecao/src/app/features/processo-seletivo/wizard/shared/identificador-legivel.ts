import type { ProblemDetails } from '@uniplus/shared-core/http';

/**
 * Conferência local do identificador legível do certame, espelhando a do servidor
 * (`IdentificadorLegivel` em Seleção): kebab-case de 3 a 64 caracteres, e nunca com a forma de
 * um Guid — a rota pública localiza o certame tanto pelo identificador quanto pelo id técnico,
 * e um valor com cara de Guid tornaria as duas ambíguas.
 *
 * O servidor continua sendo quem arbitra: esta conferência só evita um envio que ele recusaria,
 * e a mensagem de cada recusa é a mesma que ele daria.
 */

export const IDENTIFICADOR_LEGIVEL_MINIMO = 3;
export const IDENTIFICADOR_LEGIVEL_MAXIMO = 64;

const FORMATO_KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * As formas de Guid que cabem no alfabeto do kebab-case: 32 dígitos hexadecimais seguidos, ou
 * os cinco grupos separados por hífen. As demais (com chaves ou parênteses) o formato já recusa.
 */
const FORMATO_GUID =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Prefixo dos códigos com que o servidor recusa o identificador — todos pertencem ao campo. */
const PREFIXO_DAS_RECUSAS = 'uniplus.selecao.processo_seletivo.identificador_legivel_';

/** O valor como o servidor o grava: sem espaços nas pontas. */
export function normalizarIdentificadorLegivel(valor: string): string {
  return valor.trim();
}

const MENSAGEM_VAZIO = 'Informe o identificador legível do processo seletivo.';
const MENSAGEM_TAMANHO = `O identificador legível deve ter entre ${IDENTIFICADOR_LEGIVEL_MINIMO} e ${IDENTIFICADOR_LEGIVEL_MAXIMO} caracteres.`;
const MENSAGEM_FORMATO =
  'O identificador legível deve começar por letra minúscula, conter apenas letras minúsculas sem acento, dígitos e hífens, e terminar com letra ou dígito (ex.: medicina-2027).';
const MENSAGEM_GUID =
  'O identificador legível não pode ter a forma de um identificador técnico (Guid).';

function foraDoTamanho(valor: string): boolean {
  return valor.length < IDENTIFICADOR_LEGIVEL_MINIMO || valor.length > IDENTIFICADOR_LEGIVEL_MAXIMO;
}

/** Por que o valor não serve como identificador, ou `null` quando serve. Vazio é pendência. */
export function problemaDoIdentificadorLegivel(valor: string): string | null {
  const normalizado = normalizarIdentificadorLegivel(valor);
  if (normalizado === '') return MENSAGEM_VAZIO;
  if (foraDoTamanho(normalizado)) return MENSAGEM_TAMANHO;
  if (!FORMATO_KEBAB.test(normalizado)) return MENSAGEM_FORMATO;
  if (FORMATO_GUID.test(normalizado)) return MENSAGEM_GUID;
  return null;
}

/** Nome do campo do pedido de criação que carrega o identificador legível. */
export const CAMPO_DO_IDENTIFICADOR_NO_PEDIDO = 'identificadorLegivel';

/** A causa é sobre o identificador: aponta o campo dele ou tem um dos códigos dele. */
export function ehCausaDoIdentificadorLegivel(causa: {
  readonly field?: string;
  readonly code: string;
}): boolean {
  return (
    causa.field === CAMPO_DO_IDENTIFICADOR_NO_PEDIDO || causa.code.startsWith(PREFIXO_DAS_RECUSAS)
  );
}

/**
 * A recusa do servidor é sobre o identificador — e por isso aparece junto ao campo. Decide pela
 * lista de causas, em qualquer posição; sem lista, a recusa de uma só causa vale pelo código
 * dela.
 */
export function ehRecusaDoIdentificadorLegivel(
  problema: Pick<ProblemDetails, 'code' | 'errors'>,
): boolean {
  const causas = problema.errors ?? [];
  if (causas.length === 0) return ehCausaDoIdentificadorLegivel({ code: problema.code });
  return causas.some(ehCausaDoIdentificadorLegivel);
}

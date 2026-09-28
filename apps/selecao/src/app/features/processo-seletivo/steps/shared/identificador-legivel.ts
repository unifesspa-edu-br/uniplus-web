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

/** Por que o valor não serve como identificador, ou `null` quando serve. Vazio é pendência. */
export function problemaDoIdentificadorLegivel(valor: string): string | null {
  const normalizado = normalizarIdentificadorLegivel(valor);

  if (normalizado === '') return 'Informe o identificador legível do processo seletivo.';

  if (
    normalizado.length < IDENTIFICADOR_LEGIVEL_MINIMO ||
    normalizado.length > IDENTIFICADOR_LEGIVEL_MAXIMO
  ) {
    return `O identificador legível deve ter entre ${IDENTIFICADOR_LEGIVEL_MINIMO} e ${IDENTIFICADOR_LEGIVEL_MAXIMO} caracteres.`;
  }

  if (!FORMATO_KEBAB.test(normalizado)) {
    return 'O identificador legível deve começar por letra minúscula, conter apenas letras minúsculas sem acento, dígitos e hífens, e terminar com letra ou dígito (ex.: medicina-2027).';
  }

  if (FORMATO_GUID.test(normalizado)) {
    return 'O identificador legível não pode ter a forma de um identificador técnico (Guid).';
  }

  return null;
}

/** A recusa do servidor é sobre o identificador — e por isso aparece junto ao campo. */
export function ehRecusaDoIdentificadorLegivel(code: string | null | undefined): boolean {
  return code?.startsWith(PREFIXO_DAS_RECUSAS) ?? false;
}

import type { ExigenciaDeDocumento } from '../../processo-seletivo.models';

/** O token que declara ausência de restrição — o campo é obrigatório no wire. */
const QUALQUER_FORMATO = 'QUALQUER';

/**
 * Os formatos que o contrato da exigência conhece, indexados pelas grafias que o cadastro de
 * tipos de documento aceita. O cadastro é texto livre; a exigência é vocabulário fechado.
 */
const FORMATO_DO_WIRE = new Map([
  ['PDF', 'PDF'],
  ['JPEG', 'JPEG'],
  ['JPG', 'JPEG'],
  ['PNG', 'PNG'],
]);

/** Um megabyte em bytes — o cadastro declara em MB, a exigência trafega em bytes. */
const BYTES_POR_MB = 1024 * 1024;

/**
 * A restrição de arquivo que o cadastro publica para um tipo de documento. O tamanho é um inteiro
 * de 32 bits.
 */
export interface RestricaoDeArquivo {
  readonly formatosAceitos?: string | null;
  readonly tamanhoMaximoMb?: number | null;
}

/**
 * O teto em bytes, ou `null` quando o cadastro não declara tamanho.
 *
 * O contrato recebe o teto como inteiro de 32 bits e o cadastro não limita o valor em MB:
 * um tipo declarado com 2048 MB ou mais produziria um número acima do que o campo comporta, e
 * a recusa viria como 400 de desserialização, derrubando a gravação da árvore inteira por
 * causa de um documento. Acima do teto, o campo viaja ausente — "o cadastro não restringe o
 * tamanho" é mais verdadeiro que um número truncado.
 */
function tetoEmBytes(tamanhoMaximoMb: number | null | undefined): number | null {
  if (tamanhoMaximoMb === null || tamanhoMaximoMb === undefined) return null;
  if (!Number.isFinite(tamanhoMaximoMb) || tamanhoMaximoMb <= 0) return null;

  const bytes = tamanhoMaximoMb * BYTES_POR_MB;
  return bytes > MAIOR_INTEIRO_DE_32_BITS ? null : bytes;
}

/** O teto de `tamanhoMaximoBytes` no contrato — `int32`. */
const MAIOR_INTEIRO_DE_32_BITS = 2_147_483_647;

/**
 * Traduz os formatos do cadastro para o vocabulário da exigência. O que o contrato não
 * conhece volta em `naoExpressos` em vez de sumir: a tela precisa dizer que aquele formato
 * ficou de fora, senão o edital prometeria ao candidato um arquivo que a exigência recusa.
 */
export function formatosDeclarados(formatosAceitos: string | null | undefined): {
  readonly tokens: readonly string[];
  readonly naoExpressos: readonly string[];
} {
  const tokens: string[] = [];
  const naoExpressos: string[] = [];

  for (const bruto of (formatosAceitos ?? '').split(/[,;/]/)) {
    const limpo = bruto.trim();
    if (limpo === '') continue;
    const token = FORMATO_DO_WIRE.get(limpo.toUpperCase());
    if (token === undefined) naoExpressos.push(limpo);
    else if (!tokens.includes(token)) tokens.push(token);
  }

  return { tokens, naoExpressos };
}

/** Os formatos e o teto que a exigência herda da restrição do cadastro do tipo de documento. */
export function limitesDoArquivo(
  restricao?: RestricaoDeArquivo,
): Pick<ExigenciaDeDocumento, 'formatosPermitidos' | 'tamanhoMaximoBytes'> {
  const { tokens } = formatosDeclarados(restricao?.formatosAceitos);
  return {
    formatosPermitidos: tokens.length > 0 ? [...tokens] : QUALQUER_FORMATO,
    tamanhoMaximoBytes: tetoEmBytes(restricao?.tamanhoMaximoMb),
  };
}

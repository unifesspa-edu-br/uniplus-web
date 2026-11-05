import type { CampoRenderizavel } from './formulario-do-candidato.model';
import { respostaDoTextoLivre } from './confirmacao-do-campo';
import type { ControleDoCampo } from './controle-do-campo';
import type { ValorJson } from './interpretador/regras-do-formulario';

/** O número como se escreve em pt-BR: vírgula decimal, sem separador de milhar. */
const NUMERO_BR = /^-?[0-9]+(,[0-9]+)?$/;
/**
 * O número ainda sendo escrito — o sinal sozinho, ou a vírgula sem as casas decimais —, que não é erro:
 * "1," vale 1 até a casa decimal chegar, e o sinal sozinho é sem resposta.
 */
const NUMERO_BR_PELA_METADE = /^-?([0-9]+,)?$/;

export interface EntradaDoControle {
  readonly inputmode: string;
  readonly autocomplete: string;
  readonly tipo: string;
}

const ENTRADA_DO_FORMATO: Readonly<Record<string, EntradaDoControle>> = {
  CPF: { inputmode: 'numeric', autocomplete: 'off', tipo: 'text' },
  TELEFONE: { inputmode: 'tel', autocomplete: 'tel', tipo: 'tel' },
  CEP: { inputmode: 'numeric', autocomplete: 'postal-code', tipo: 'text' },
  EMAIL: { inputmode: 'email', autocomplete: 'email', tipo: 'email' },
  NOME_PESSOA: { inputmode: 'text', autocomplete: 'name', tipo: 'text' },
};

/** O teclado, o preenchimento automático e o tipo do `input`: pelo formato do campo, ou pelo controle. */
export function entradaDoCampo(
  formato: string | null | undefined,
  controle: ControleDoCampo,
): EntradaDoControle {
  return (
    ENTRADA_DO_FORMATO[formato ?? ''] ?? {
      inputmode: controle === 'numero' ? 'decimal' : 'text',
      autocomplete: 'off',
      tipo: controle === 'data' ? 'date' : 'text',
    }
  );
}

/** O número digitado que não se reconhece, nem como número pela metade: não vira resposta. */
export function numeroNaoReconhecido(texto: string): boolean {
  const limpo = texto.trim();
  return limpo !== '' && !NUMERO_BR.test(limpo) && !NUMERO_BR_PELA_METADE.test(limpo);
}

/** A resposta que o texto digitado dá: o número em pt-BR, os códigos separados por ponto e vírgula, ou o texto. */
export function respostaDoTexto(
  controle: ControleDoCampo,
  campo: CampoRenderizavel,
  texto: string,
): ValorJson | undefined {
  const limpo = texto.trim();
  if (limpo === '') return undefined;
  if (controle === 'numero') return respostaDoNumero(limpo);
  if (controle === 'codigos') return respostaDosCodigos(limpo);
  return respostaDoTextoLivre(campo, texto);
}

function respostaDoNumero(limpo: string): number | undefined {
  if (NUMERO_BR.test(limpo)) return Number(limpo.replace(',', '.'));
  return /^-?[0-9]+,$/.test(limpo) ? Number(limpo.slice(0, -1)) : undefined;
}

function respostaDosCodigos(limpo: string): string[] | undefined {
  const codigos = limpo
    .split(';')
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '');
  return codigos.length === 0 ? undefined : codigos;
}

export function textoDa(resposta: ValorJson | undefined): string {
  if (resposta === undefined || resposta === null) return '';
  if (Array.isArray(resposta)) return resposta.join('; ');
  if (typeof resposta === 'number')
    return resposta.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 20 });
  return String(resposta);
}

import { CODIGO_CADASTRO_FORMATO } from './codigo-cadastro.util';
import { cardinalPorExtenso, ordinalPorExtenso } from './numero-por-extenso.util';

export type CodigoDoNome =
  | { readonly ok: true; readonly codigo: string }
  | { readonly ok: false; readonly limite: number };

function numeroInicialPorExtenso(algarismos: string, sinal: string): string {
  const numeroSemZeros = algarismos.replace(/\./gu, '').replace(/^0+/u, '') || '0';
  const numero = Number(numeroSemZeros);
  if (numero > 999) return `numero ${numeroSemZeros}`;
  if (numero === 0 || !sinal) return cardinalPorExtenso(numero);
  return ordinalPorExtenso(numero, sinal === 'ª' ? 'FEMININO' : 'MASCULINO');
}

function tirarSublinhadosDasPontas(texto: string): string {
  let inicio = 0;
  let fim = texto.length;
  while (inicio < fim && texto[inicio] === '_') inicio += 1;
  while (fim > inicio && texto[fim - 1] === '_') fim -= 1;
  return texto.slice(inicio, fim);
}

function normalizarNome(nome: string): string {
  const inicio = nome.match(/^[^\p{L}\p{N}]*(\d{1,3}(?:\.\d{3})+|\d+)([ªº°])?/u);
  const texto = inicio
    ? `${numeroInicialPorExtenso(inicio[1], inicio[2] ?? '')} ${nome.slice(inicio[0].length)}`
    : nome;
  const normalizado = texto
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '_');
  return tirarSublinhadosDasPontas(normalizado).toUpperCase();
}

/** Forma um código válido ou informa que ele excede o limite. */
export function formarCodigoDoNome(nome: string, limite: number): CodigoDoNome | null {
  const codigo = normalizarNome(nome);
  if (!CODIGO_CADASTRO_FORMATO.test(codigo)) return null;
  return codigo.length <= limite ? { ok: true, codigo } : { ok: false, limite };
}

/** Forma um código disponível, usando a reserva quando necessário. */
export function formarCodigoUnicoDoNome(
  nome: string,
  reserva: string,
  usados: ReadonlySet<string>,
  limite: number,
): CodigoDoNome {
  const resultado = formarCodigoDoNome(nome, limite) ?? { ok: true, codigo: reserva };
  if (!resultado.ok) return resultado;
  let codigo = resultado.codigo;
  for (let sufixo = 2; usados.has(codigo); sufixo += 1) {
    codigo = `${resultado.codigo}_${sufixo}`;
  }
  return codigo.length <= limite ? { ok: true, codigo } : { ok: false, limite };
}

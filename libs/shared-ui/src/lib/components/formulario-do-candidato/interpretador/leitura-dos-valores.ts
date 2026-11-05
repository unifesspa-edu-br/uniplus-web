/** A recusa de regras que não formam um formulário: o caminho do problema e a causa. */
export class Recusa extends Error {
  constructor(
    readonly caminho: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Os elementos da lista, cada um lido no caminho dele; o elemento nulo é recusado. */
export function lista<T, R>(
  elementos: readonly T[] | null | undefined,
  caminho: string,
  ler: (elemento: T, caminho: string) => R,
): R[] {
  if (elementos === null || elementos === undefined) return [];
  if (!Array.isArray(elementos)) throw new Recusa(caminho, 'O elemento é uma lista.');
  return elementos.map((elemento, i) => {
    const doElemento = `${caminho}[${i}]`;
    if (elemento === null || elemento === undefined)
      throw new Recusa(doElemento, `O elemento '${doElemento}' das regras é nulo.`);
    return ler(elemento, doElemento);
  });
}

export function textos(
  valores: readonly string[] | null | undefined,
  caminho: string,
  mensagem: string,
): string[] {
  const lidos = lista(valores, caminho, (valor) => valor);
  if (lidos.length === 0 || lidos.some((v) => typeof v !== 'string' || v.trim() === ''))
    throw new Recusa(caminho, mensagem);
  return lidos;
}

/**
 * O valor lógico, como a API o lê do corpo: ausente é falso, e o de outro tipo — um texto como "true"
 * — é recusado.
 */
export function booleano(valor: boolean | undefined, caminho: string): boolean {
  if (valor === undefined) return false;
  if (typeof valor !== 'boolean') throw new Recusa(caminho, 'O valor é verdadeiro ou falso.');
  return valor;
}

/**
 * O número, como a API o lê do corpo: aceita também o número escrito em texto, como `"9"`; ausente é
 * nulo, e o de outra forma é recusado.
 */
export function numero(valor: unknown, caminho: string): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string' && /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(valor))
    return Number(valor);
  throw new Recusa(caminho, 'O valor é um número.');
}

export function codigo(valor: string, caminho: string): string {
  if (typeof valor !== 'string' || valor.trim() === '')
    throw new Recusa(caminho, 'O código é obrigatório.');
  return valor;
}

export function garantirUnicos(codigos: readonly string[], oQue: string): void {
  const vistos = new Set<string>();
  for (const valor of codigos) {
    if (vistos.has(valor))
      throw new Recusa('regras', `O código '${valor}' aparece mais de uma vez como ${oQue}.`);
    vistos.add(valor);
  }
}

export function ehObjeto(valor: unknown): valor is object {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

import { QUANTIDADE_MINIMA_DE_ITENS } from './documentos-avaliados';
import type { DocumentoNaTela, ItemDeComprovacao } from './regras-de-documentos';

/**
 * Se a exigência está atendida, dado o conjunto das exigências que a avaliação deu por satisfeitas. Num
 * grupo "um ou outro", a exigência está atendida quando o grupo está: bastam as alternativas que o
 * `minimo` pede, e cada alternativa que junta documentos pede todos eles.
 */
export function exigenciaAtendida(
  chave: string,
  regras: readonly ItemDeComprovacao[],
  atendidas: ReadonlySet<string>,
): boolean {
  const grupos = gruposQueContem(chave, regras);
  // Exigência que as respostas atuais já não pedem está fora da recusa antiga.
  if (grupos === null) return true;
  return atendidas.has(chave) || grupos.some((grupo) => atendido(grupo, atendidas));
}

function atendido(elemento: ItemDeComprovacao, atendidas: ReadonlySet<string>): boolean {
  if (elemento.forma === 'DOCUMENTO') return documentoAtendido(elemento.documento, atendidas);
  return elemento.forma === QUANTIDADE_MINIMA_DE_ITENS
    ? elemento.itens.filter((item) => atendido(item, atendidas)).length >= elemento.minimo
    : elemento.itens.every((item) => atendido(item, atendidas));
}

function documentoAtendido(documento: DocumentoNaTela, atendidas: ReadonlySet<string>): boolean {
  const chaves =
    documento.exigidas.length > 0 ? documento.exigidas.map((e) => e.chave) : [documento.chave];
  return chaves.every((c) => atendidas.has(c));
}

/**
 * Os grupos "um ou outro" que contêm a exigência, do mais interno ao mais externo; nulo quando a
 * estrutura de regras atual não a pede mais.
 */
function gruposQueContem(
  chave: string,
  elementos: readonly ItemDeComprovacao[],
): readonly ItemDeComprovacao[] | null {
  for (const elemento of elementos) {
    if (elemento.forma === 'DOCUMENTO') {
      if (elemento.documento.exigidas.some((e) => e.chave === chave)) return [];
      continue;
    }
    const dentro = gruposQueContem(chave, elemento.itens);
    if (dentro)
      return elemento.forma === QUANTIDADE_MINIMA_DE_ITENS ? [...dentro, elemento] : dentro;
  }
  return null;
}

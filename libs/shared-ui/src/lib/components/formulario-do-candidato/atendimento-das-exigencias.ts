import { GRUPO_OU } from './documentos-avaliados';
import type { DocumentoNaTela, NoDeDocumentos } from './arvore-de-documentos';

/**
 * Se a exigência está atendida, dado o conjunto das exigências que a avaliação deu por satisfeitas. Num
 * grupo "um ou outro", a exigência está atendida quando o grupo está: bastam as alternativas que o
 * `minimo` pede, e cada alternativa que junta documentos pede todos eles.
 */
export function exigenciaAtendida(
  chave: string,
  arvore: readonly NoDeDocumentos[],
  atendidas: ReadonlySet<string>,
): boolean {
  const grupos = gruposQueContem(chave, arvore);
  // Exigência que as respostas atuais já não pedem está fora da recusa antiga.
  if (grupos === null) return true;
  return atendidas.has(chave) || grupos.some((grupo) => atendido(grupo, atendidas));
}

function atendido(no: NoDeDocumentos, atendidas: ReadonlySet<string>): boolean {
  if (no.tipo === 'DOCUMENTO') return documentoAtendido(no.documento, atendidas);
  return no.tipo === GRUPO_OU
    ? no.itens.filter((item) => atendido(item, atendidas)).length >= no.minimo
    : no.itens.every((item) => atendido(item, atendidas));
}

function documentoAtendido(documento: DocumentoNaTela, atendidas: ReadonlySet<string>): boolean {
  const chaves =
    documento.exigidas.length > 0 ? documento.exigidas.map((e) => e.chave) : [documento.chave];
  return chaves.every((c) => atendidas.has(c));
}

/**
 * Os grupos "um ou outro" que contêm a exigência, do mais interno ao mais externo; nulo quando a
 * árvore atual não a pede mais.
 */
function gruposQueContem(
  chave: string,
  nos: readonly NoDeDocumentos[],
): readonly NoDeDocumentos[] | null {
  for (const no of nos) {
    if (no.tipo === 'DOCUMENTO') {
      if (no.documento.exigidas.some((e) => e.chave === chave)) return [];
      continue;
    }
    const dentro = gruposQueContem(chave, no.itens);
    if (dentro) return no.tipo === GRUPO_OU ? [...dentro, no] : dentro;
  }
  return null;
}

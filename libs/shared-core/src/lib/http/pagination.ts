import { parseLink } from './link-header';

/**
 * Helpers de paginação por cursor opaco do contrato V1 da `uniplus-api`
 * (ADR-0026 do backend, ADR-0015 do frontend). Cursor é uma string opaca
 * AES-GCM; o cliente jamais decifra (ADR-0031 do backend é binding).
 *
 * Tipo `Cursor` é branded em compile time para evitar que código acidente
 * compare cursors com URLs ou tente desserializar — atribuir `string` cru
 * exige cast explícito via {@link createCursor}.
 *
 * Uso típico (preview da Frente 6 do plano):
 *
 * ```ts
 * this.editaisApi.listar(this.cursor()).subscribe(result => {
 *   if (!result.ok) return;
 *   this.editais.update(prev => [...prev, ...result.data]);
 *   this.cursor.set(extractNextCursor(result.headers.get('Link')));
 * });
 * ```
 */

declare const cursorBrand: unique symbol;

/**
 * String opaca branded — wire format do cursor de paginação. Comparações
 * por igualdade funcionam (ambos são strings em runtime); operações de
 * string como `slice`, `JSON.parse` etc. NÃO devem ser feitas — cliente
 * trata como token opaco fim-a-fim.
 */
export type Cursor = string & { readonly [cursorBrand]: true };

/**
 * Wraps uma string como `Cursor`. Não valida conteúdo — o servidor é a
 * única autoridade sobre o formato (cifra AES-GCM, payload, expiry).
 *
 * Use principalmente para hidratar cursor persistido em rota/estado:
 *
 * ```ts
 * const stored = this.route.snapshot.queryParamMap.get('cursor');
 * const cursor = stored ? createCursor(stored) : null;
 * ```
 */
export function createCursor(value: string): Cursor {
  return value as Cursor;
}

/**
 * Serializa `Cursor` de volta para `string` plana (ex.: para escrever em
 * query param). Idempotente — `Cursor` já é string em runtime.
 */
export function cursorToString(cursor: Cursor): string {
  return cursor;
}

/**
 * Extrai o cursor da próxima página do header `Link`. Retorna `null` quando:
 *
 * - header é `null`, `undefined` ou string vazia;
 * - header não tem entrada `rel="next"`;
 * - a URI do `rel="next"` não tem o query param `cursor=`.
 *
 * Casos legítimos de `null`:
 *
 * - última página da paginação (servidor não emite `rel="next"`);
 * - endpoint não-paginado retornando outros rels (ex.: `rel="related"`).
 */
export function extractNextCursor(linkHeader: string | null | undefined): Cursor | null {
  const links = parseLink(linkHeader);
  const next = links.get('next');
  if (next === undefined) {
    return null;
  }
  const cursorValue = extractCursorParam(next.uri);
  if (cursorValue === null) {
    return null;
  }
  return createCursor(cursorValue);
}

/**
 * Extrai o valor de `?cursor=...` ou `&cursor=...` da URI sem precisar
 * resolver host (URI no `Link` pode vir relativa, RFC 5988 §5.4). Volta
 * `null` quando não há param `cursor`. Decode percent-encoding via
 * `decodeURIComponent`.
 */
function extractCursorParam(uri: string): string | null {
  const queryStart = uri.indexOf('?');
  if (queryStart < 0) {
    return null;
  }
  const queryString = uri.slice(queryStart + 1);
  // Hash fragment (`#...`) não tem sentido em paginação, mas remover por
  // robustez caso o servidor emita.
  const hashIdx = queryString.indexOf('#');
  const cleanQuery = hashIdx < 0 ? queryString : queryString.slice(0, hashIdx);

  for (const pair of cleanQuery.split('&')) {
    const equalsIdx = pair.indexOf('=');
    if (equalsIdx < 0) {
      continue;
    }
    const key = pair.slice(0, equalsIdx);
    if (key !== 'cursor') {
      continue;
    }
    const rawValue = pair.slice(equalsIdx + 1);
    if (rawValue.length === 0) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      // Servidor mandou percent-encoding malformado; trata como ausente
      // em vez de explodir o consumer.
      return null;
    }
  }
  return null;
}

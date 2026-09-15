import { parseLink } from './link-header';
import type { ProblemDetails } from './problem-details';

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

/**
 * Teto de itens por página aceito pela `uniplus-api` (ADR-0026 do
 * **backend** `uniplus-api`). `limit` fora da faixa 1..100 responde
 * 422 `uniplus.cursor.limit_invalido`.
 */
export const API_MAX_PAGE_SIZE = 100;

/**
 * Códigos que o binder de cursor pagination da `uniplus-api` emite quando a
 * continuação não serve mais (`PaginationDomainErrorRegistration.cs`):
 *
 * - `uniplus.cursor.invalido` (**400**) — o cursor não continua ESTA consulta:
 *   busca, ordenação ou filtro divergem do que o assinou.
 * - `uniplus.cursor.expirado` (**410**) — o cursor passou da validade (15 min).
 *
 * Nos dois casos a listagem deve recomeçar do início, sem cursor (a #693 chama
 * isso de CA-14c). `uniplus.cursor.limit_invalido`/`direcao_invalida` são 422 e
 * NÃO entram aqui — são erro do parâmetro, não do cursor.
 */
export const CURSOR_INVALIDO_CODE = 'uniplus.cursor.invalido';
export const CURSOR_EXPIRADO_CODE = 'uniplus.cursor.expirado';

/**
 * O erro veio de um cursor que não continua mais a consulta — a UI deve
 * recarregar a listagem do começo.
 *
 * Casa primeiro pelo `code` do wire. O fallback por `status` 400/410 cobre o
 * caso em que a resposta não é `problem+json` e o interceptor sintetiza o
 * `ProblemDetails` com `code` em `uniplus.client.*` (o `code` do cursor não
 * chega): as rotas paginadas da `uniplus-api` só devolvem 400/410 pelo binder
 * de cursor, então o status sozinho já identifica o caso com segurança.
 */
export function ehCursorDePaginacaoObsoleto(problem: ProblemDetails): boolean {
  return (
    problem.code === CURSOR_INVALIDO_CODE ||
    problem.code === CURSOR_EXPIRADO_CODE ||
    problem.status === 400 ||
    problem.status === 410
  );
}

/** O cursor obsoleto é por expiração (410 / `uniplus.cursor.expirado`), não por divergência. */
export function ehCursorDePaginacaoExpirado(problem: ProblemDetails): boolean {
  return problem.code === CURSOR_EXPIRADO_CODE || problem.status === 410;
}

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
 * Direção de navegação da paginação por cursor bidirecional (ADR-0089 do
 * `uniplus-api`). É o valor literal do query param `direction` que o cliente
 * envia junto ao cursor — `'next'` para avançar, `'prev'` para retroceder.
 *
 * O servidor cifra a direção dentro do próprio cursor e rejeita no boundary
 * um `direction` que divirja do cifrado (anti-adulteração), então o cliente
 * deve enviar a direção que casa com o cursor seguido: `extractNextCursor`
 * pareia com `'next'`, `extractPrevCursor` com `'prev'`. Na primeira página
 * (sem cursor) o param é omitido — o servidor coage para `'next'`.
 */
export type PaginationDirection = 'next' | 'prev';

/**
 * Extrai o cursor da próxima página do header `Link` (`rel="next"`). Retorna
 * `null` quando:
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
  return extractCursorForRel(linkHeader, 'next');
}

/**
 * Extrai o cursor da página anterior do header `Link` (`rel="prev"`).
 * Simétrico a {@link extractNextCursor} — retorna `null` quando o header está
 * ausente/vazio, não tem `rel="prev"`, ou o `rel="prev"` não carrega
 * `cursor=`.
 *
 * `null` é o caso legítimo da **primeira página**: o servidor não emite
 * `rel="prev"` quando não há âncora anterior (ADR-0089 do `uniplus-api`).
 */
export function extractPrevCursor(linkHeader: string | null | undefined): Cursor | null {
  return extractCursorForRel(linkHeader, 'prev');
}

/**
 * Resolve o cursor opaco de um `rel` específico do header `Link`. Núcleo
 * comum a {@link extractNextCursor}/{@link extractPrevCursor}: parseia o
 * header, localiza o link-value do `rel` e extrai o query param `cursor=`.
 */
function extractCursorForRel(
  linkHeader: string | null | undefined,
  rel: 'next' | 'prev',
): Cursor | null {
  const links = parseLink(linkHeader);
  const link = links.get(rel);
  if (link === undefined) {
    return null;
  }
  const cursorValue = extractCursorParam(link.uri);
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

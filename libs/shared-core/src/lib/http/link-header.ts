/**
 * Parser do header HTTP `Link` (RFC 5988/8288). Implementação puro TypeScript
 * sem dependência runtime — RFC 5988 é estável desde 2010 e o subset usado
 * pela `uniplus-api` (paginação por cursor opaco, ADR-0026) é trivial.
 *
 * Uso típico:
 *
 * ```ts
 * const links = parseLink(response.headers.get('Link'));
 * const next = links.get('next');
 * if (next) {
 *   const nextUrl = next.uri;
 * }
 * ```
 *
 * @see https://www.rfc-editor.org/rfc/rfc5988.html
 * @see https://www.rfc-editor.org/rfc/rfc8288.html
 * @see ADR-0015 — decisão de manter o parser local em vez de usar lib npm.
 */

/**
 * Um link-value parseado: a URI entre `<>` e seus parameters (rel, title,
 * type, etc.) na ordem em que aparecem.
 */
export type ParsedLink = {
  readonly uri: string;
  readonly params: Readonly<Record<string, string>>;
};

/**
 * Parseia um header `Link` (RFC 5988/8288) em Map indexado por `rel`.
 *
 * Regras:
 * - Header `null`, `undefined` ou vazio retorna Map vazio.
 * - Cada link-value sem param `rel` é ignorado (RFC 5988 não exige rel
 *   mas todo uso prático tem).
 * - Param `rel` com múltiplos valores separados por whitespace
 *   (ex.: `rel="self next"`) registra uma entrada por valor.
 * - Quando dois link-values declaram o mesmo rel, o **primeiro** vence
 *   (Map.set é skip). Determinístico e previsível.
 * - Param keys são lowercased (RFC 5988 §5 — case-insensitive). Param
 *   values quoted-string preservam o case original do conteúdo.
 */
export function parseLink(headerValue: string | null | undefined): Map<string, ParsedLink> {
  const result = new Map<string, ParsedLink>();
  if (headerValue === null || headerValue === undefined) {
    return result;
  }
  const trimmed = headerValue.trim();
  if (trimmed.length === 0) {
    return result;
  }

  for (const segment of splitTopLevelCommas(trimmed)) {
    const linkValue = parseLinkValue(segment);
    if (linkValue === null) {
      continue;
    }
    const rel = linkValue.params['rel'];
    if (rel === undefined) {
      continue;
    }
    for (const r of rel.trim().split(/\s+/u)) {
      if (r.length === 0 || result.has(r)) {
        continue;
      }
      result.set(r, linkValue);
    }
  }
  return result;
}

/**
 * Tokenizador char-by-char que separa o header em link-values pela vírgula
 * de top-level — preserva vírgulas dentro de `<URI>` ou de quoted-strings
 * (suportando escape com `\`).
 */
function splitTopLevelCommas(input: string): string[] {
  const segments: string[] = [];
  let inAngle = false;
  let inQuotes = false;
  let escapeNext = false;
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inQuotes) {
      if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inQuotes = false;
      }
      continue;
    }
    if (inAngle) {
      if (ch === '>') {
        inAngle = false;
      }
      continue;
    }
    if (ch === '<') {
      inAngle = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      segments.push(input.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(input.slice(start));
  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Parseia um único link-value: extrai a URI entre `<>` e os params separados
 * por `;`. Retorna `null` quando o segmento não tem a forma `<...>;...`.
 */
function parseLinkValue(segment: string): ParsedLink | null {
  if (!segment.startsWith('<')) {
    return null;
  }
  const closeIdx = segment.indexOf('>');
  if (closeIdx < 0) {
    return null;
  }
  const uri = segment.slice(1, closeIdx);
  const paramsRaw = segment.slice(closeIdx + 1).trim();

  const params: Record<string, string> = {};
  if (paramsRaw.length === 0) {
    return { uri, params };
  }
  // O remainder começa idealmente com `;`; remove o `;` líder.
  const tail = paramsRaw.startsWith(';') ? paramsRaw.slice(1) : paramsRaw;
  for (const paramSegment of splitTopLevelSemicolons(tail)) {
    const equalsIdx = paramSegment.indexOf('=');
    if (equalsIdx < 0) {
      // RFC 5988 permite param sem valor (flag) — guardamos como string vazia
      // para que o consumer detecte presença sem precisar de tipo separado.
      const key = paramSegment.trim().toLowerCase();
      if (key.length > 0 && !(key in params)) {
        params[key] = '';
      }
      continue;
    }
    const key = paramSegment.slice(0, equalsIdx).trim().toLowerCase();
    if (key.length === 0 || key in params) {
      continue;
    }
    params[key] = unquoteIfQuoted(paramSegment.slice(equalsIdx + 1).trim());
  }
  return { uri, params };
}

/**
 * Mesma semântica de `splitTopLevelCommas`, mas para `;` separando parameters.
 */
function splitTopLevelSemicolons(input: string): string[] {
  const segments: string[] = [];
  let inQuotes = false;
  let escapeNext = false;
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inQuotes) {
      if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inQuotes = false;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ';') {
      segments.push(input.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(input.slice(start));
  return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Remove aspas externas e desfaz escapes `\\X` → `X` quando o valor é
 * quoted-string bem formada. Caso contrário devolve o token como veio
 * (RFC 5988 §5 permite token simples sem aspas para valores ASCII curtos).
 *
 * Mal formada inclui o caso onde o `"` final é parte de um escape (`\\"`)
 * — a string abriu com `"` mas nunca fechou de verdade. Devolver cru
 * preserva o sinal de erro para o consumer em vez de produzir um valor
 * silenciosamente incorreto.
 */
function unquoteIfQuoted(value: string): string {
  if (value.length < 2 || value[0] !== '"' || value[value.length - 1] !== '"') {
    return value;
  }
  // Conta `\` consecutivos imediatamente antes do `"` final. Quantidade ímpar
  // significa que o `"` foi escapado — a string não está realmente fechada.
  let trailingBackslashes = 0;
  for (let i = value.length - 2; i >= 1 && value[i] === '\\'; i--) {
    trailingBackslashes++;
  }
  if (trailingBackslashes % 2 === 1) {
    return value;
  }
  const inner = value.slice(1, -1);
  let out = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '\\' && i + 1 < inner.length) {
      out += inner[i + 1];
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

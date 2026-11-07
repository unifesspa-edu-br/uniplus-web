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

  for (const segment of splitTopLevel(trimmed, DELIMITA_LINK_VALUES)) {
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

type Contexto = 'livre' | 'aspas' | 'angulos';

interface Varredura {
  contexto: Contexto;
  escapado: boolean;
}

/** Quais trechos o tokenizador atravessa sem tratar o separador como separador. */
interface DelimitacaoDeSegmentos {
  readonly separador: string;
  /** `<URI>` é opaca: só o header inteiro (vírgula) a tem; os parameters (`;`) não. */
  readonly protegeUri: boolean;
}

const DELIMITA_LINK_VALUES: DelimitacaoDeSegmentos = { separador: ',', protegeUri: true };
const DELIMITA_PARAMETERS: DelimitacaoDeSegmentos = { separador: ';', protegeUri: false };

function avancarVarredura(v: Varredura, ch: string, protegeUri: boolean): void {
  if (v.escapado) {
    v.escapado = false;
  } else if (v.contexto === 'aspas') {
    if (ch === '\\') v.escapado = true;
    else if (ch === '"') v.contexto = 'livre';
  } else if (v.contexto === 'angulos') {
    if (ch === '>') v.contexto = 'livre';
  } else if (ch === '"') {
    v.contexto = 'aspas';
  } else if (protegeUri && ch === '<') {
    v.contexto = 'angulos';
  }
}

/**
 * Tokenizador char-by-char que separa o texto no separador de top-level — preserva o separador dentro
 * de `<URI>` (quando a delimitação a protege) ou de quoted-strings (suportando escape com `\`).
 */
function splitTopLevel(input: string, delimitacao: DelimitacaoDeSegmentos): string[] {
  const segments: string[] = [];
  const varredura: Varredura = { contexto: 'livre', escapado: false };
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (varredura.contexto === 'livre' && !varredura.escapado && ch === delimitacao.separador) {
      segments.push(input.slice(start, i));
      start = i + 1;
    }
    avancarVarredura(varredura, ch, delimitacao.protegeUri);
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
  // O remainder começa idealmente com `;`; remove o `;` líder.
  const tail = paramsRaw.startsWith(';') ? paramsRaw.slice(1) : paramsRaw;
  return { uri, params: parseParameters(tail) };
}

function parseParameters(tail: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const paramSegment of splitTopLevel(tail, DELIMITA_PARAMETERS)) {
    const equalsIdx = paramSegment.indexOf('=');
    // RFC 5988 permite param sem valor (flag) — guardamos como string vazia
    // para que o consumer detecte presença sem precisar de tipo separado.
    const hasValue = equalsIdx >= 0;
    const key = (hasValue ? paramSegment.slice(0, equalsIdx) : paramSegment).trim().toLowerCase();
    if (key.length === 0 || key in params) {
      continue;
    }
    params[key] = hasValue ? unquoteIfQuoted(paramSegment.slice(equalsIdx + 1).trim()) : '';
  }
  return params;
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

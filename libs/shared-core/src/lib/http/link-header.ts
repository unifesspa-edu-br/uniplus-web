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
  const links = new Map<string, ParsedLink>();
  for (const linkValue of linkValuesDe(headerValue)) {
    for (const rel of relsDe(linkValue)) {
      if (!links.has(rel)) {
        links.set(rel, linkValue);
      }
    }
  }
  return links;
}

function linkValuesDe(headerValue: string | null | undefined): ParsedLink[] {
  const texto = headerValue?.trim() ?? '';
  return splitTopLevel(texto, DELIMITA_LINK_VALUES)
    .map(parseLinkValue)
    .filter((linkValue): linkValue is ParsedLink => linkValue !== null);
}

function relsDe(linkValue: ParsedLink): string[] {
  const rel = linkValue.params['rel'];
  return rel === undefined
    ? []
    : rel
        .trim()
        .split(/\s+/u)
        .filter((r) => r.length > 0);
}

type Contexto = 'livre' | 'aspas' | 'angulos';

/** Quais trechos o tokenizador atravessa sem tratar o separador como separador. */
interface DelimitacaoDeSegmentos {
  readonly separador: string;
  /** `<URI>` é opaca: só o header inteiro (vírgula) a tem; os parameters (`;`) não. */
  readonly protegeUri: boolean;
}

const DELIMITA_LINK_VALUES: DelimitacaoDeSegmentos = { separador: ',', protegeUri: true };
const DELIMITA_PARAMETERS: DelimitacaoDeSegmentos = { separador: ';', protegeUri: false };

/**
 * Onde o tokenizador está no texto: fora de qualquer trecho protegido (`livre`), dentro de uma
 * quoted-string (`aspas`, com escape por `\`) ou dentro de `<URI>` (`angulos`).
 */
class Varredura {
  private contexto: Contexto = 'livre';
  private escapado = false;

  constructor(private readonly protegeUri: boolean) {}

  get noTopLevel(): boolean {
    return this.contexto === 'livre' && !this.escapado;
  }

  avancar(ch: string): void {
    if (this.escapado) {
      this.escapado = false;
    } else if (this.contexto === 'aspas') {
      this.dentroDeAspas(ch);
    } else if (this.contexto === 'angulos') {
      if (ch === '>') this.contexto = 'livre';
    } else if (ch === '"') {
      this.contexto = 'aspas';
    } else if (this.protegeUri && ch === '<') {
      this.contexto = 'angulos';
    }
  }

  private dentroDeAspas(ch: string): void {
    if (ch === '\\') this.escapado = true;
    else if (ch === '"') this.contexto = 'livre';
  }
}

/**
 * Tokenizador char-by-char que separa o texto no separador de top-level — preserva o separador dentro
 * de `<URI>` (quando a delimitação a protege) ou de quoted-strings (suportando escape com `\`).
 */
function splitTopLevel(input: string, delimitacao: DelimitacaoDeSegmentos): string[] {
  const segmentos: string[] = [];
  const varredura = new Varredura(delimitacao.protegeUri);
  let inicio = 0;
  for (let i = 0; i < input.length; i++) {
    if (varredura.noTopLevel && input[i] === delimitacao.separador) {
      segmentos.push(input.slice(inicio, i));
      inicio = i + 1;
    }
    varredura.avancar(input[i]);
  }
  segmentos.push(input.slice(inicio));
  return segmentos.map((s) => s.trim()).filter((s) => s.length > 0);
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
  return ehQuotedStringFechada(value) ? desfazerEscapes(value.slice(1, -1)) : value;
}

function ehQuotedStringFechada(value: string): boolean {
  const entreAspas = value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"';
  // Quantidade ímpar de `\` antes do `"` final significa que o `"` foi escapado.
  return entreAspas && barrasAntesDoFecho(value) % 2 === 0;
}

function barrasAntesDoFecho(value: string): number {
  let barras = 0;
  for (let i = value.length - 2; i >= 1 && value[i] === '\\'; i--) {
    barras++;
  }
  return barras;
}

function desfazerEscapes(conteudo: string): string {
  return conteudo.replace(/\\([\s\S])/gu, '$1');
}

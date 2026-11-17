import type { ProblemDetails } from './problem-details';

type IdentidadeDoProblema = Pick<ProblemDetails, 'type' | 'code'>;

function lerUrl(texto: string, base?: string | URL): URL | null {
  try {
    return new URL(texto, base);
  } catch {
    return null;
  }
}

function diretorioDe(url: URL): string {
  return url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
}

function ultimoSegmento(url: URL): string {
  return url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
}

const SEGMENTO_DE_CODIGO = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

function ehSegmentoSimples(codigo: string): boolean {
  return SEGMENTO_DE_CODIGO.test(codigo) && !codigo.includes('..');
}

function ehTypeMontadoComOCodigo(tipo: URL | null, code: string): tipo is URL {
  return tipo?.protocol === 'https:' && code !== '' && ultimoSegmento(tipo) === code;
}

function ficaNoDiretorioDoTipo(pagina: URL, tipo: URL): boolean {
  return (
    pagina.origin === tipo.origin &&
    diretorioDe(pagina) === diretorioDe(tipo) &&
    pagina.search === '' &&
    pagina.hash === ''
  );
}

/**
 * Endereço da página que explica um código de erro, ao lado da página do problema.
 *
 * A API monta `type` como a base das páginas de erro seguida do `code`; só nesse caso o `type`
 * indica onde ficam as páginas. Um `type` que não é `https:`, que não termina no `code` ou que
 * o cliente montou sozinho não aponta página alguma.
 *
 * @param codigo código do erro de um campo, aceito só como um nome simples (letras, dígitos, `.`,
 * `_` e `-`): o endereço devolvido nunca sai da pasta e do servidor do `type` nem ganha consulta ou
 * fragmento.
 * @returns o endereço `https:` da página, ou `null` quando não há como localizá-la.
 */
export function paginaDoErro(problema: IdentidadeDoProblema, codigo: string): string | null {
  const tipo = lerUrl(problema.type);
  if (!ehTypeMontadoComOCodigo(tipo, problema.code) || !ehSegmentoSimples(codigo)) {
    return null;
  }
  const pagina = lerUrl(codigo, tipo);
  return pagina !== null && ficaNoDiretorioDoTipo(pagina, tipo) ? pagina.href : null;
}

/** Endereço da página do próprio problema, para o erro que não traz `errors[]`. */
export function paginaDoProblema(problema: IdentidadeDoProblema): string | null {
  return paginaDoErro(problema, problema.code);
}

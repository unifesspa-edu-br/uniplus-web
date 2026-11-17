/** Por que um texto não é um ponteiro JSON válido (RFC 6901). */
export type RecusaDoPonteiro = 'semBarraInicial' | 'escapeInvalido';

export type ResultadoDaLeituraDoPonteiro =
  | { readonly lido: true; readonly segmentos: readonly string[] }
  | { readonly lido: false; readonly recusa: RecusaDoPonteiro };

const ESCAPE_SEM_SENTIDO = /~(?![01])/;

/**
 * Separa o ponteiro nos nomes de campo e posições que ele percorre. O ponteiro vazio é a raiz do
 * documento e não tem segmentos. Dentro de cada segmento, `~1` é `/` e `~0` é `~`, decodificados
 * nessa ordem para que `~01` seja `~1` e nunca `/`.
 */
export function segmentosDoPonteiro(ponteiro: string): ResultadoDaLeituraDoPonteiro {
  if (ponteiro === '') {
    return { lido: true, segmentos: [] };
  }
  if (!ponteiro.startsWith('/')) {
    return { lido: false, recusa: 'semBarraInicial' };
  }
  const segmentosCodificados = ponteiro.slice(1).split('/');
  if (segmentosCodificados.some((segmento) => ESCAPE_SEM_SENTIDO.test(segmento))) {
    return { lido: false, recusa: 'escapeInvalido' };
  }
  return { lido: true, segmentos: segmentosCodificados.map(decodificarSegmento) };
}

function decodificarSegmento(segmento: string): string {
  return segmento.replaceAll('~1', '/').replaceAll('~0', '~');
}
